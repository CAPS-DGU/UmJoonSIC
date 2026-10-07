import { ChevronDown, ChevronUp, GripVertical, Minus } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useStrings } from '@/i18n';
import { INLINE_ICON_BUTTON } from '@/lib/controls';
import { moveItem } from '@/lib/moveItem';

interface Props {
  /** The assembled files, in their order (project.sic's asm list). */
  files: string[];
  /** The main program's file (project.sic's main, as a file of the list), marked. */
  mainFile: string | null;
  onChange: (files: string[]) => void;
  /** Shown after a file that is not in the project folder. */
  missing: (file: string) => boolean;
  missingMark: React.ReactNode;
}

/**
 * The assembled files in their order, with the same "1st, 2nd" as the file tree. A file is
 * moved by dragging its handle, or with Alt+↑ / Alt+↓ on the handle (the keyboard way of the
 * ARIA reorderable-list pattern); each move is announced for screen readers.
 */
export function AsmOrderList({ files, mainFile, onChange, missing, missingMark }: Props) {
  const t = useStrings();
  const [dragged, setDragged] = useState<number | null>(null);
  const [drop, setDrop] = useState<{ index: number; after: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const list = useRef<HTMLUListElement>(null);
  /** A file moved by keyboard: its handle gets the focus back once the new order is shown. */
  const refocus = useRef<string | null>(null);

  useEffect(() => {
    const file = refocus.current;
    if (!file) return;
    const handle = [
      ...(list.current?.querySelectorAll<HTMLElement>('[data-asm-handle]') ?? []),
    ].find(el => el.closest('li')?.getAttribute('data-asm-file') === file);
    if (handle && files.indexOf(file) === Number(handle.dataset.asmHandle)) {
      handle.focus();
      refocus.current = null;
    }
  }, [files]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= files.length || from === to) return;
    onChange(moveItem(files, from, to));
    setAnnouncement(t.settings.moved(files[from], t.files.ordinal(to + 1), files.length));
  };

  const onDragOver = (e: DragEvent, index: number) => {
    if (dragged === null) return;
    e.preventDefault();
    const box = e.currentTarget.getBoundingClientRect();
    setDrop({ index, after: e.clientY > box.top + box.height / 2 });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (dragged !== null && drop) {
      // The place in the list without the dragged file.
      let to = drop.index + (drop.after ? 1 : 0);
      if (dragged < to) to -= 1;
      move(dragged, to);
    }
    setDragged(null);
    setDrop(null);
  };

  const onHandleKey = (e: KeyboardEvent, index: number) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const to = index + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= files.length) return;
    // Keep the focus on the moved file's handle (the list changes when the settings are written).
    refocus.current = files[index];
    move(index, to);
  };

  return (
    <>
      <ul
        ref={list}
        className="divide-y divide-gray-200 rounded border border-gray-300 bg-white"
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
        }}
      >
        {files.map((file, index) => (
          <li
            key={file}
            data-asm-file={file}
            className={`flex items-center gap-2 px-1 py-1 ${dragged === index ? 'opacity-50' : ''} ${
              drop?.index === index
                ? drop.after
                  ? 'shadow-[inset_0_-2px_0_var(--color-blue-500)]'
                  : 'shadow-[inset_0_2px_0_var(--color-blue-500)]'
                : ''
            }`}
            onDragOver={e => onDragOver(e, index)}
            onDrop={onDrop}
          >
            <button
              type="button"
              draggable
              data-asm-handle={index}
              className={`${INLINE_ICON_BUTTON} cursor-grab active:cursor-grabbing`}
              title={t.settings.reorder(file)}
              aria-label={t.settings.reorder(file)}
              onDragStart={e => {
                setDragged(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', file);
              }}
              onDragEnd={() => {
                setDragged(null);
                setDrop(null);
              }}
              onKeyDown={e => onHandleKey(e, index)}
            >
              <GripVertical width={14} height={14} />
            </button>
            <span
              className="w-9 shrink-0 rounded-full bg-blue-50 text-center text-[11px] font-semibold leading-4 text-blue-700 tabular-nums"
              data-assembly-order={index + 1}
            >
              {t.files.ordinal(index + 1)}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono" title={file}>
              {file}
            </span>
            {file === mainFile && (
              <span className="shrink-0 rounded bg-blue-600 px-1.5 text-[11px] font-semibold leading-4 text-white">
                {t.settings.mainFile}
              </span>
            )}
            {missing(file) && missingMark}
            {/* The way without dragging (WCAG 2.5.7). */}
            <button
              type="button"
              className={INLINE_ICON_BUTTON}
              title={t.settings.moveUp}
              aria-label={`${t.settings.moveUp}: ${file}`}
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
            >
              <ChevronUp width={14} height={14} />
            </button>
            <button
              type="button"
              className={INLINE_ICON_BUTTON}
              title={t.settings.moveDown}
              aria-label={`${t.settings.moveDown}: ${file}`}
              disabled={index === files.length - 1}
              onClick={() => move(index, index + 1)}
            >
              <ChevronDown width={14} height={14} />
            </button>
            <button
              type="button"
              className={INLINE_ICON_BUTTON}
              title={t.settings.remove}
              aria-label={t.settings.remove}
              onClick={() => onChange(files.filter(f => f !== file))}
            >
              <Minus width={14} height={14} />
            </button>
          </li>
        ))}
        {files.length === 0 && (
          <li className="px-2 py-1 text-xs text-gray-600">{t.settings.noFile}</li>
        )}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
