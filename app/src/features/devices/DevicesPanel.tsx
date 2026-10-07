import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleHelp,
  Copy,
  FileText,
  Hourglass,
  RotateCcw,
  Unplug,
} from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { deviceHex } from '@/features/debugger/lib/deviceUse';
import { useRunningStore } from '@/features/debugger/runningStore';
import {
  useDeviceStreamStore,
  type DeviceStream,
  type FreshBytes,
} from '@/features/devices/deviceStreamStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { openProjectSettings } from '@/features/project/projectSettingsTab';
import { useProjectStore } from '@/features/project/projectStore';
import { useStrings } from '@/i18n';
import { CHANGED_CLASSES } from '@/lib/changeMarks';
import { INLINE_ICON_BUTTON, PANEL_HEADER } from '@/lib/controls';
import { isAbsolutePath, resolveInProject } from '@/lib/projectPath';
import { notify } from '@/stores/toastStore';

// The Devices panel: one lane per device of
// the loaded program, with what it read (RD) and wrote (WD), recorded instruction by
// instruction (deviceStreamStore).

type View = 'text' | 'hex';

/** Bytes drawn per lane and direction (the store keeps more, for Copy). */
const DRAWN_BYTES = 8 * 1024;
/** How long a lane's activity light stays on after the device was used. */
const ACTIVITY_MS = 600;
/** TD's "not ready" answers in a row after which an unconnected device is said to wait. */
const WAITING_AFTER = 3;
const HEX_ROW = 16;

/**
 * How a byte is drawn: read or written before the last update; new in it; the next one RD
 * reads; not read yet; written to an unconnected device (it went nowhere).
 */
type Tone = 'done' | 'fresh' | 'next' | 'unread' | 'discarded' | 'discardedFresh';

const TONE_CLASSES: Record<Tone, string> = {
  done: '',
  fresh: CHANGED_CLASSES,
  // A block cursor, as in a terminal: dark on the light theme, light on the dark one (the
  // dark theme swaps the greys and white).
  next: 'rounded-[2px] bg-gray-900 text-white',
  unread: 'text-gray-500',
  discarded: 'text-gray-600 line-through decoration-gray-500',
  discardedFresh: `text-gray-600 line-through decoration-gray-500 ${CHANGED_CLASSES}`,
};

/** A run of bytes drawn alike, from `start` (the offset in the stream), or the end-of-file mark. */
/** A run of bytes drawn alike, or the end-of-file mark (with the cursor when all is read). */
type Piece =
  | { tone: Tone; start: number; bytes: number[] }
  | { eof: true; start: number; cursor: boolean };

const isPrintable = (b: number) => b >= 0x20 && b < 0x7f;
const hex2 = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');

/** The bytes of a text file as the simulator reads them (one byte each). */
const fileBytes = (text: string) => [...new TextEncoder().encode(text)];

/**
 * Bytes as text: printable ASCII as is; a line feed as ↵ and a new line; NUL as a muted ␀;
 * any other byte as a small hex chip (a NUL or control byte must not vanish or break Copy).
 */
function textOf(bytes: number[]): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let j = i + 1;
    if (isPrintable(b)) {
      while (j < bytes.length && isPrintable(bytes[j])) j++;
      out.push(String.fromCharCode(...bytes.slice(i, j)));
    } else if (b === 0x0a) {
      while (j < bytes.length && bytes[j] === 0x0a) j++;
      out.push(
        <span key={i} className="text-gray-400" aria-hidden>
          {'↵\n'.repeat(j - i)}
        </span>,
      );
    } else if (b === 0) {
      while (j < bytes.length && bytes[j] === 0) j++;
      out.push(
        <span key={i} className="text-gray-400">
          {'␀'.repeat(j - i)}
        </span>,
      );
    } else {
      out.push(
        <span
          key={i}
          className="mx-px rounded-sm bg-gray-200 px-0.5 align-[1px] text-[10px] leading-none text-gray-700"
        >
          {hex2(b)}
        </span>,
      );
    }
    i = j;
  }
  return out;
}

/**
 * The byte under the cursor as one cell of text, in the cursor's own colours: a character, ↵
 * (the line break follows the cursor), ␀, or its two hex digits.
 */
function cursorGlyph(b: number) {
  if (isPrintable(b)) return String.fromCharCode(b);
  if (b === 0x0a) return '↵';
  if (b === 0) return '␀';
  return <span className="text-[10px]">{hex2(b)}</span>;
}

/** What a copy of the bytes holds: Text as the view shows it (other bytes as \xHH), or Hex. */
function copyText(bytes: number[], view: View, start: number) {
  if (view === 'hex') {
    const rows: string[] = [];
    for (let i = 0; i < bytes.length; i += HEX_ROW) {
      const row = bytes.slice(i, i + HEX_ROW);
      const ascii = row.map(b => (isPrintable(b) ? String.fromCharCode(b) : '.')).join('');
      rows.push(
        `${(start + i).toString(16).toUpperCase().padStart(6, '0')}  ${row
          .map(hex2)
          .join(' ')
          .padEnd(HEX_ROW * 3 - 1)}  ${ascii}`,
      );
    }
    return rows.join('\n');
  }
  return bytes
    .map(b =>
      isPrintable(b) || b === 0x0a || b === 0x09 ? String.fromCharCode(b) : `\\x${hex2(b)}`,
    )
    .join('');
}

/** Whether `at` (Date.now()) is less than ACTIVITY_MS ago; re-rendered when it no longer is. */
function useRecent(at: number | undefined) {
  const [, setTick] = useState(0);
  const left = at === undefined ? 0 : at + ACTIVITY_MS - Date.now();
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setTick(n => n + 1), left);
    return () => clearTimeout(timer);
  }, [at, left]);
  return left > 0;
}

/**
 * The pieces of one direction of a lane. `bytes`: the kept bytes, the last of `count` in all,
 * the last `fresh` of them new; `input`: the run's input file, for RD, drawn as a tape (what
 * was read, the next byte, the rest, the end of the file).
 */
function piecesOf(
  bytes: number[],
  count: number,
  fresh: number,
  input: number[] | null,
  discarded: boolean,
): { pieces: Piece[]; hidden: number } {
  const dropped = count - bytes.length;
  const drawnFrom = dropped + Math.max(0, bytes.length - DRAWN_BYTES);
  const freshFrom = Math.max(drawnFrom, count - fresh);
  const eofAt = input ? input.length : null;
  // Where the drawing changes: where new bytes begin, the end of the file if it was read past.
  const cuts = new Set([drawnFrom, freshFrom, count]);
  if (eofAt !== null && eofAt >= drawnFrom && eofAt < count) cuts.add(eofAt);
  const sorted = [...cuts].sort((x, y) => x - y);
  const pieces: Piece[] = [];
  for (let k = 0; k + 1 < sorted.length; k++) {
    const [from, to] = [sorted[k], sorted[k + 1]];
    if (from === eofAt) pieces.push({ eof: true, start: from, cursor: true });
    const isFresh = from >= freshFrom;
    const tone: Tone = discarded
      ? isFresh
        ? 'discardedFresh'
        : 'discarded'
      : isFresh
        ? 'fresh'
        : 'done';
    pieces.push({ tone, start: from, bytes: bytes.slice(from - dropped, to - dropped) });
  }
  if (input && count < input.length) {
    pieces.push({ tone: 'next', start: count, bytes: [input[count]] });
    const rest = input.slice(count + 1, count + 1 + DRAWN_BYTES);
    if (rest.length) pieces.push({ tone: 'unread', start: count + 1, bytes: rest });
  }
  if (input && count <= input.length) {
    pieces.push({ eof: true, start: input.length, cursor: count === input.length });
  }
  return { pieces, hidden: drawnFrom };
}

/** The pieces as text, the next byte (or the end) marked for following. */
function TextPieces({ pieces }: { pieces: Piece[] }) {
  const t = useStrings();
  return pieces.map(piece =>
    'eof' in piece ? (
      <span
        key={`eof-${piece.start}`}
        className={`mx-0.5 rounded px-1 align-[1px] text-[10px] leading-none ${
          piece.cursor ? 'bg-gray-900 text-white' : 'border border-gray-400 text-gray-600'
        }`}
        title={t.devices.pastEnd}
        data-eof
        data-follow={piece.cursor || undefined}
      >
        {t.devices.endOfFile}
      </span>
    ) : piece.tone === 'next' ? (
      <Fragment key={`next-${piece.start}`}>
        <span className={TONE_CLASSES.next} title={t.devices.nextByte} data-follow>
          {cursorGlyph(piece.bytes[0])}
        </span>
        {piece.bytes[0] === 0x0a && '\n'}
      </Fragment>
    ) : (
      <span
        // A new run of fresh bytes is a new element: its flash plays.
        key={`${piece.tone}-${piece.start}`}
        className={TONE_CLASSES[piece.tone]}
        title={
          piece.tone === 'unread'
            ? t.devices.notReadYet
            : piece.tone.startsWith('discarded')
              ? t.devices.discardedTitle
              : undefined
        }
      >
        {textOf(piece.bytes)}
      </span>
    ),
  );
}

/** The pieces as rows of 16 bytes: offset, hex, ASCII (as `hd` prints them). */
function HexPieces({ pieces }: { pieces: Piece[] }) {
  const t = useStrings();
  const cells = new Map<number, { byte: number; tone: Tone }>();
  let eofAt: number | null = null;
  let eofCursor = false;
  for (const piece of pieces) {
    if ('eof' in piece) {
      eofAt = piece.start;
      eofCursor = piece.cursor;
    } else piece.bytes.forEach((byte, i) => cells.set(piece.start + i, { byte, tone: piece.tone }));
  }
  const offsets = [...cells.keys()].sort((a, b) => a - b);
  // The bytes before the end of the file, its mark, the bytes read after it (00s).
  const before = eofAt === null ? offsets : offsets.filter(o => o < eofAt!);
  const after = eofAt === null ? [] : offsets.filter(o => o >= eofAt!);

  const rows = (section: number[]) => {
    if (section.length === 0) return [];
    const inSection = new Set(section);
    const out: ReactNode[] = [];
    const last = section[section.length - 1];
    for (let row = section[0] - (section[0] % HEX_ROW); row <= last; row += HEX_ROW) {
      const hexCells: ReactNode[] = [];
      const ascii: ReactNode[] = [];
      for (let i = 0; i < HEX_ROW; i++) {
        const cell = inSection.has(row + i) ? cells.get(row + i) : undefined;
        if (i > 0) hexCells.push(' ');
        if (!cell) {
          hexCells.push('  ');
          ascii.push(' ');
          continue;
        }
        hexCells.push(
          <span
            key={i}
            className={TONE_CLASSES[cell.tone]}
            data-follow={cell.tone === 'next' ? true : undefined}
          >
            {hex2(cell.byte)}
          </span>,
        );
        ascii.push(
          <span key={i} className={cell.tone === 'unread' ? 'text-gray-500' : undefined}>
            {isPrintable(cell.byte) ? String.fromCharCode(cell.byte) : '.'}
          </span>,
        );
      }
      out.push(
        <div key={row} className="whitespace-pre">
          <span className="text-gray-500 select-none">
            {row.toString(16).toUpperCase().padStart(6, '0')}
          </span>
          {'  '}
          {hexCells}
          {'  '}
          <span className="text-gray-700">{ascii}</span>
        </div>,
      );
    }
    return out;
  };

  return (
    <>
      <div key="before">{rows(before)}</div>
      {eofAt !== null && (
        <div className="text-[11px] text-gray-600 select-none" title={t.devices.pastEnd} data-eof>
          ──{' '}
          <span
            className={eofCursor ? 'rounded-[2px] bg-gray-900 px-1 text-white' : ''}
            data-follow={eofCursor || undefined}
          >
            {t.devices.endOfFile}
          </span>{' '}
          ──
        </div>
      )}
      <div key="after">{rows(after)}</div>
    </>
  );
}

interface StreamBoxProps {
  pieces: Piece[];
  view: View;
  /** Grows with every byte read or written: a box that follows the end scrolls along. */
  total: number;
  label?: string;
  empty: string;
}

/**
 * A lane's bytes, at most five lines high, then scrolled. It follows the end (or an input's
 * next byte) while that is in view; scrolled away, it stays put and offers a way back with the
 * number of new bytes (as Chrome's and VS Code's consoles do).
 */
function StreamBox({ pieces, view, total, label, empty }: StreamBoxProps) {
  const t = useStrings();
  const box = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const ownScroll = useRef(false);
  const shownTotal = useRef(total);
  const [newBytes, setNewBytes] = useState(0);

  /** Where following goes: the next byte of an input, else the end. */
  const targetTop = (el: HTMLDivElement) => {
    const next = el.querySelector<HTMLElement>('[data-follow]');
    if (!next) return el.scrollHeight - el.clientHeight;
    return next.offsetTop - el.clientHeight + next.offsetHeight + 4;
  };
  const follow = () => {
    const el = box.current;
    if (!el) return;
    const top = Math.max(0, Math.min(targetTop(el), el.scrollHeight - el.clientHeight));
    if (Math.abs(el.scrollTop - top) > 1) {
      ownScroll.current = true;
      el.scrollTop = top;
    }
  };

  useLayoutEffect(() => {
    const added = total - shownTotal.current;
    shownTotal.current = total;
    if (following.current) follow();
    else if (added > 0) setNewBytes(n => n + added);
    // `follow` reads the box as it is now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, view]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    if (ownScroll.current) {
      ownScroll.current = false;
      return;
    }
    // Following again once the user is back where following would be.
    following.current =
      el.scrollTop >= Math.min(targetTop(el), el.scrollHeight - el.clientHeight) - 4;
    if (following.current) setNewBytes(0);
  };

  return (
    <div className="relative min-w-0">
      {label && <div className="px-0.5 text-[11px] text-gray-600">{label}</div>}
      <div
        ref={box}
        onScroll={onScroll}
        className={`slim-scroll relative max-h-[6.75rem] min-h-7 overflow-auto rounded border border-gray-300 bg-white px-2 py-1 font-mono text-sm leading-5 ${
          view === 'text' ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : ''
        }`}
        data-stream-box
      >
        {pieces.length === 0 ? (
          <span className="text-gray-600">{empty}</span>
        ) : view === 'text' ? (
          <TextPieces pieces={pieces} />
        ) : (
          <HexPieces pieces={pieces} />
        )}
      </div>
      {newBytes > 0 && (
        <button
          type="button"
          className="absolute right-3 bottom-1.5 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 text-xs leading-5 text-white shadow hover:bg-blue-700"
          onClick={() => {
            following.current = true;
            setNewBytes(0);
            follow();
          }}
          data-new-bytes={newBytes}
        >
          <ArrowDown className="size-3" aria-hidden />
          {t.devices.newBytes(newBytes)}
        </button>
      )}
    </div>
  );
}

interface LaneProps {
  stream: DeviceStream;
  view: View;
  /** The device's file in the settings now (it may differ from the run's). */
  settingsFile: string | null;
  /** The contents of the run's input file, for a device the program reads. */
  input: number[] | null;
  fresh: FreshBytes | undefined;
  activeAt: number | undefined;
}

function DeviceLane({ stream, view, settingsFile, input, fresh, activeAt }: LaneProps) {
  const t = useStrings();
  const projectPath = useProjectStore(s => s.projectPath);
  const isRunning = useRunningStore(s => s.isRunning);
  const openTab = useEditorTabStore(s => s.openTab);
  const lit = useRecent(activeAt);
  const hex = deviceHex(stream.device);
  const reads = stream.uses.includes('read');
  const writes = stream.uses.includes('write');
  const file = stream.file;
  const inProject = file !== null && !isAbsolutePath(file);
  const waiting = file === null && stream.notReady >= WAITING_AFTER;

  const readPart = reads
    ? piecesOf(stream.read, stream.readCount, fresh?.read ?? 0, file ? input : null, false)
    : null;
  const writePart = writes
    ? piecesOf(stream.written, stream.writtenCount, fresh?.written ?? 0, null, file === null)
    : null;
  const hidden = (readPart?.hidden ?? 0) + (writePart?.hidden ?? 0);

  const counts = [
    reads ? t.devices.readCount(stream.readCount, file && input ? input.length : null) : null,
    writes ? t.devices.written(stream.writtenCount) : null,
    stream.tests > 0 || (!reads && !writes) ? t.devices.tested(stream.tests) : null,
  ].filter(Boolean);

  const copy = async () => {
    const parts = [
      reads ? copyText(stream.read, view, stream.readCount - stream.read.length) : '',
      writes ? copyText(stream.written, view, stream.writtenCount - stream.written.length) : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'));
      notify('info', t.devices.copied);
    } catch {
      notify('warning', t.devices.copyFailed);
    }
  };

  const Direction = reads ? ArrowDownToLine : writes ? ArrowUpFromLine : CircleHelp;
  const direction = [reads && t.devices.read, writes && t.devices.write]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex min-w-0 flex-col gap-1 px-2 py-1.5" data-device={hex}>
      <div className="flex min-h-6 min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span className="rounded bg-gray-200 px-1.5 font-mono text-sm leading-5 font-semibold">
          {hex}
        </span>
        {stream.labels.length > 0 && (
          <span className="max-w-40 truncate font-mono text-sm" title={stream.labels.join(', ')}>
            {stream.labels.join(', ')}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5 text-gray-700">
          <Direction className="size-3.5" aria-hidden />
          {direction || t.devices.test}
        </span>
        {file ? (
          <button
            type="button"
            className="inline-flex min-w-0 items-center gap-1 text-blue-700 hover:underline disabled:text-gray-700 disabled:no-underline"
            title={inProject ? t.devices.openFile(file) : resolveInProject(projectPath, file)}
            disabled={!inProject}
            onClick={() => openTab({ title: file.split('/').pop()!, filePath: file })}
          >
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="max-w-48 truncate">{file}</span>
          </button>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-amber-800"
            title={t.devices.notConnectedTitle}
          >
            <Unplug className="size-3.5 shrink-0" aria-hidden />
            {t.devices.notConnected}
            {writes && stream.writtenCount > 0 && (
              <span className="rounded bg-amber-100 px-1 text-[11px]">{t.devices.discarded}</span>
            )}
          </span>
        )}
        {file === null && !waiting && (
          <button
            type="button"
            className="font-medium text-blue-700 hover:underline"
            onClick={() => void openProjectSettings()}
          >
            {t.devices.connect}
          </button>
        )}
        <span className="ml-auto text-gray-600 tabular-nums">{counts.join(' · ')}</span>
        <span
          className={`size-1.5 shrink-0 rounded-full transition-colors duration-300 ${lit ? 'bg-amber-500' : 'bg-gray-300'}`}
          title={t.devices.activity}
          data-device-activity={lit ? 'on' : 'off'}
        />
        <button
          type="button"
          className={INLINE_ICON_BUTTON}
          title={t.devices.copyTitle(hex)}
          aria-label={t.devices.copyTitle(hex)}
          disabled={stream.readCount + stream.writtenCount === 0}
          onClick={() => void copy()}
        >
          <Copy className="size-3.5" aria-hidden />
        </button>
      </div>

      {waiting && (
        <p
          className="flex items-start gap-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900"
          data-device-waiting={hex}
        >
          <Hourglass className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {t.devices.waiting(hex)}{' '}
            <button
              type="button"
              className="font-medium text-blue-700 hover:underline"
              onClick={() => void openProjectSettings()}
            >
              {t.devices.connect}
            </button>
          </span>
        </p>
      )}
      {isRunning && settingsFile !== file && (
        <p className="flex items-center gap-2 text-xs text-gray-700">
          {t.devices.settingsChanged}
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
            onClick={() => void useRunningStore.getState().restart()}
          >
            <RotateCcw className="size-3" aria-hidden />
            {t.devices.restart}
          </button>
        </p>
      )}
      {hidden > 0 && (
        <p className="text-[11px] text-gray-600">{t.devices.earlierNotShown(hidden)}</p>
      )}

      <div className="flex min-w-0 flex-col gap-1">
        {readPart && (
          <StreamBox
            pieces={readPart.pieces}
            view={view}
            total={stream.readCount}
            label={writes ? t.devices.readLabel : undefined}
            empty={t.devices.nothingYet}
          />
        )}
        {writePart && (
          <StreamBox
            pieces={writePart.pieces}
            view={view}
            total={stream.writtenCount}
            label={reads ? t.devices.writtenLabel : undefined}
            empty={t.devices.nothingYet}
          />
        )}
      </div>
      {reads && file && input && stream.readCount > input.length && (
        <p className="text-[11px] text-gray-600">{t.devices.pastEnd}</p>
      )}
    </li>
  );
}

/**
 * The Devices panel: for each device the loaded program uses, what it read (RD) and wrote
 * (WD). The streams stay after the program ends or is stopped, until the next load. New bytes
 * flash, then stay marked until the next step, as values do in the memory viewer and the
 * Watch; the activity light shows use in every run mode.
 */
export default function DevicesPanel() {
  const t = useStrings();
  const streams = useDeviceStreamStore(s => s.streams);
  const generation = useDeviceStreamStore(s => s.generation);
  const fresh = useDeviceStreamStore(s => s.fresh);
  const activity = useDeviceStreamStore(s => s.activity);
  const unseen = useDeviceStreamStore(s => s.unseen);
  const markSeen = useDeviceStreamStore(s => s.markSeen);
  const isRunning = useRunningStore(s => s.isRunning);
  const projectPath = useProjectStore(s => s.projectPath);
  const filedevices = useProjectStore(s => s.settings.filedevices);
  const [view, setView] = useState<View>('text');
  const [inputs, setInputs] = useState<Record<number, number[]>>({});

  // Shown: the tab's dot goes.
  useEffect(() => {
    if (unseen) markSeen();
  }, [unseen, markSeen]);

  // The input files of this run, read when it begins.
  const inputKey = streams
    .filter(s => s.uses.includes('read') && s.file)
    .map(s => `${s.device}=${s.file}`)
    .join(',');
  useEffect(() => {
    let current = true;
    const wanted = streams.filter(s => s.uses.includes('read') && s.file);
    void Promise.all(
      wanted.map(async s => {
        const res = await window.api.readFile(resolveInProject(projectPath, s.file!));
        return [
          s.device,
          res.success && typeof res.data === 'string' ? fileBytes(res.data) : null,
        ] as const;
      }),
    ).then(entries => {
      if (current) {
        setInputs(
          Object.fromEntries(entries.filter(([, bytes]) => bytes !== null)) as Record<
            number,
            number[]
          >,
        );
      }
    });
    return () => {
      current = false;
    };
    // `inputKey` and `generation` stand for the run's input files.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, generation, projectPath]);

  if (streams.length === 0) {
    return (
      <p className="p-4 text-sm text-gray-600" data-devices-empty>
        {isRunning ? t.devices.none : t.devices.empty}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden text-gray-900">
      <div className={PANEL_HEADER}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700">{t.devices.view}</span>
          <div
            className="flex rounded-md border border-gray-300 p-0.5"
            role="radiogroup"
            aria-label={t.devices.view}
          >
            {(['text', 'hex'] as View[]).map(v => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                className={`rounded px-2 text-xs leading-5 ${view === v ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={() => setView(v)}
              >
                {v === 'text' ? t.devices.text : t.devices.hex}
              </button>
            ))}
          </div>
        </div>
        {!isRunning && <span className="text-xs text-gray-600">{t.devices.lastRun}</span>}
      </div>
      <ul className="slim-scroll flex-1 divide-y divide-gray-200 overflow-auto">
        {streams.map(stream => (
          <Fragment key={stream.device}>
            <DeviceLane
              stream={stream}
              view={view}
              settingsFile={filedevices.find(d => d.index === stream.device)?.filename ?? null}
              input={inputs[stream.device] ?? null}
              fresh={fresh.get(stream.device)}
              activeAt={activity.get(stream.device)}
            />
          </Fragment>
        ))}
      </ul>
    </div>
  );
}
