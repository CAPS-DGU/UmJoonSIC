import { ChevronDown, FilePlus, FileText, FolderOpen, Plus, Unplug, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { deviceHex, type DeviceAccess } from '@/features/debugger/lib/deviceUse';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { useProjectSources } from '@/features/devices/useProjectSources';
import { usableDevicePaths } from '@/features/project/devicePaths';
import {
  connectDevice,
  connectToNewFile,
  disconnectDevice,
  parseDeviceNumber,
  suggestedFileName,
} from '@/features/project/deviceSettings';
import { useProjectStore } from '@/features/project/projectStore';
import { useStrings } from '@/i18n';
import { FORM_BUTTON, FORM_FIELD, INLINE_ICON_BUTTON } from '@/lib/controls';
import { isAbsolutePath, resolveInProject, toProjectRelativePath } from '@/lib/projectPath';

/** One row: a device the project connects, the program uses, or both. */
interface Row {
  device: number;
  labels: string[];
  uses: DeviceAccess[];
  filename: string | null;
}

/** The files a device can be connected to: the project's files other than its sources. */
function useDeviceFiles() {
  const fileTree = useProjectStore(s => s.fileTree);
  return fileTree
    .map(f => f.relativePath)
    .filter(p => !p.endsWith('/') && !/\.(asm|lst|sic|obj)$/i.test(p) && !p.startsWith('.out/'))
    .sort();
}

/** Which device paths cannot be used here (a path from another computer, a missing folder). */
function useUnusable(paths: string[]) {
  const projectPath = useProjectStore(s => s.projectPath);
  const [bad, setBad] = useState<Set<string>>(new Set());
  const key = paths.join('\n');
  useEffect(() => {
    let current = true;
    void usableDevicePaths(
      projectPath,
      paths.map(p => resolveInProject(projectPath, p)),
    ).then(ok => {
      if (current) setBad(new Set(paths.filter((_, i) => !ok[i])));
    });
    return () => {
      current = false;
    };
    // `key` stands for `paths`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, projectPath]);
  return bad;
}

/**
 * The menu of a device's file: the project's files, a new file named after the device, or
 * a file chosen in the system's dialog (a Save dialog for an output, where a new name can be
 * typed). It opens in the project folder.
 */
function FileMenu({ row, label, onPicked }: { row: Row; label: string; onPicked?: () => void }) {
  const t = useStrings();
  const projectPath = useProjectStore(s => s.projectPath);
  const files = useDeviceFiles();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const newName = suggestedFileName(row.device, row.labels);
  const outputOnly = row.uses.includes('write') && !row.uses.includes('read');

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const done = () => {
    setOpen(false);
    onPicked?.();
  };
  const browse = async () => {
    setOpen(false);
    const res = await window.api.pickFile({
      defaultPath: projectPath,
      save: outputOnly,
      suggestedName: newName,
    });
    if (res.success && res.data) {
      await connectDevice(row.device, toProjectRelativePath(projectPath, res.data));
      onPicked?.();
    }
  };

  const item =
    'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-100';
  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        className={`${FORM_BUTTON} max-w-full gap-1 font-mono`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t.settings.chooseTheFile}
        onClick={() => setOpen(o => !o)}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 z-30 mt-1 flex max-h-64 w-64 flex-col overflow-auto rounded-md border border-gray-300 bg-white p-1 shadow-lg"
        >
          {files.length > 0 && (
            <>
              <span className="px-2 py-1 text-xs font-semibold text-gray-600">
                {t.settings.projectFiles}
              </span>
              {files.map(file => (
                <button
                  key={file}
                  type="button"
                  role="menuitem"
                  className={`${item} font-mono`}
                  onClick={() => void connectDevice(row.device, file).then(done)}
                >
                  <FileText className="size-4 shrink-0 text-gray-700" aria-hidden />
                  <span className="truncate">{file}</span>
                </button>
              ))}
              <div className="my-1 h-px bg-gray-200" role="separator" />
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => void connectToNewFile(row.device, newName).then(done)}
          >
            <FilePlus className="size-4 shrink-0 text-gray-700" aria-hidden />
            <span className="truncate">{t.settings.newFile(newName)}</span>
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => void browse()}>
            <FolderOpen className="size-4 shrink-0 text-gray-700" aria-hidden />
            {t.settings.browse}
          </button>
        </div>
      )}
    </div>
  );
}

/** "Input (RD)", "Output (WD)" …: how the program uses a device, in words. */
function describeUse(uses: DeviceAccess[], t: ReturnType<typeof useStrings>) {
  const reads = uses.includes('read');
  const writes = uses.includes('write');
  if (reads && writes) return t.settings.useBoth;
  if (reads) return t.settings.useRead;
  if (writes) return t.settings.useWrite;
  if (uses.includes('test')) return t.settings.useTest;
  return t.settings.useNone;
}

/**
 * The devices table of the project settings: the devices the
 * program uses (read from its source, also before any run) and those project.sic connects,
 * in one list. A device the program uses but that is not connected gets a one-click
 * "Connect to new file indev.txt"; any file is chosen from a menu of the project's files.
 * Changes are written at once.
 */
export function DeviceTable() {
  const t = useStrings();
  const filedevices = useProjectStore(s => s.settings.filedevices);
  const openTab = useEditorTabStore(s => s.openTab);
  const detected = useProjectSources().devices;
  const [adding, setAdding] = useState(false);
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');

  const rows: Row[] = [];
  for (const d of detected) {
    rows.push({ device: d.device, labels: d.labels, uses: d.uses, filename: null });
  }
  for (const d of filedevices) {
    const row = rows.find(r => r.device === d.index);
    if (row) row.filename = d.filename;
    else rows.push({ device: d.index, labels: [], uses: [], filename: d.filename });
  }
  rows.sort((a, b) => a.device - b.device);
  const unusable = useUnusable(rows.flatMap(r => (r.filename ? [r.filename] : [])));

  // Suggestions for a new row: devices the program uses but are not connected, then the
  // textbook's F1 (input) and 05 (output).
  const suggestions = [
    ...rows.filter(r => !r.filename).map(r => deviceHex(r.device)),
    'F1',
    '05',
  ].filter((v, i, all) => all.indexOf(v) === i && !filedevices.some(d => deviceHex(d.index) === v));

  const parsed = parseDeviceNumber(number);
  const checkNumber = () => {
    if (parsed === null) {
      setError(t.settings.badNumber);
      return false;
    }
    const taken = filedevices.find(d => d.index === parsed);
    if (taken) {
      setError(t.settings.alreadyConnected(deviceHex(parsed), taken.filename));
      return false;
    }
    setError('');
    return true;
  };
  const closeAdd = () => {
    setAdding(false);
    setNumber('');
    setError('');
  };

  const cell = 'px-2 py-1 align-middle';
  return (
    <div className="flex flex-col gap-2">
      <div className="slim-scroll overflow-x-auto rounded border border-gray-300 bg-white">
        <table className="w-full min-w-[34rem] border-collapse text-sm" data-device-table>
          <thead className="border-b border-gray-300 bg-gray-50 text-left text-xs text-gray-700">
            <tr>
              <th className={`${cell} w-28 font-semibold`}>{t.settings.columnDevice}</th>
              <th className={`${cell} w-36 font-semibold`}>{t.settings.columnUse}</th>
              <th className={`${cell} font-semibold`}>{t.settings.columnFile}</th>
              <th className={`${cell} w-16`} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map(row => {
              const inProject = row.filename !== null && !isAbsolutePath(row.filename);
              return (
                <tr key={row.device} className="h-9" data-device-row={deviceHex(row.device)}>
                  <td className={cell}>
                    <span className="rounded bg-gray-200 px-1.5 font-mono font-semibold">
                      {deviceHex(row.device)}
                    </span>
                    {row.labels.length > 0 && (
                      <span className="ml-1.5 font-mono text-xs text-gray-600">
                        {row.labels[0]}
                      </span>
                    )}
                  </td>
                  <td className={`${cell} text-gray-800`}>{describeUse(row.uses, t)}</td>
                  <td className={cell}>
                    {row.filename ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <FileMenu row={row} label={row.filename} />
                        {unusable.has(row.filename) && (
                          <span className="text-xs text-amber-700" title={t.settings.fileMissing}>
                            {t.settings.fileMissing}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-amber-700">{t.settings.notConnected}</span>
                        <button
                          type="button"
                          className="inline-flex h-7 items-center rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700"
                          onClick={() =>
                            void connectToNewFile(
                              row.device,
                              suggestedFileName(row.device, row.labels),
                            )
                          }
                        >
                          {t.settings.connectNew(suggestedFileName(row.device, row.labels))}
                        </button>
                        <FileMenu row={row} label={t.settings.chooseTheFile} />
                      </div>
                    )}
                  </td>
                  <td className={`${cell} text-right whitespace-nowrap`}>
                    {row.filename && inProject && (
                      <button
                        type="button"
                        className={INLINE_ICON_BUTTON}
                        title={t.settings.openFile}
                        aria-label={t.settings.openFile}
                        onClick={() =>
                          openTab({
                            title: row.filename!.split('/').pop()!,
                            filePath: row.filename!,
                          })
                        }
                      >
                        <FileText width={14} height={14} />
                      </button>
                    )}
                    {row.filename && (
                      <button
                        type="button"
                        className={INLINE_ICON_BUTTON}
                        title={t.settings.disconnect}
                        aria-label={t.settings.disconnect}
                        onClick={() => void disconnectDevice(row.device)}
                      >
                        <Unplug width={14} height={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !adding && (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-sm text-gray-600">
                  {t.settings.noDevice}
                </td>
              </tr>
            )}
            {adding && (
              <tr className="h-9 bg-blue-50/40" data-device-add-row>
                <td className={cell} colSpan={2}>
                  <input
                    autoFocus
                    list="device-number-suggestions"
                    aria-label={t.settings.deviceNumber}
                    aria-invalid={!!error}
                    placeholder={t.settings.numberHint}
                    className={`${FORM_FIELD} w-full max-w-48 font-mono uppercase`}
                    value={number}
                    onChange={e => {
                      setNumber(e.target.value);
                      setError('');
                    }}
                    onBlur={() => number && checkNumber()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') checkNumber();
                      if (e.key === 'Escape') closeAdd();
                    }}
                  />
                  <datalist id="device-number-suggestions">
                    {suggestions.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </td>
                <td className={cell}>
                  {parsed !== null && !filedevices.some(d => d.index === parsed) && (
                    <FileMenu
                      row={{
                        device: parsed,
                        labels: rows.find(r => r.device === parsed)?.labels ?? [],
                        uses: rows.find(r => r.device === parsed)?.uses ?? [],
                        filename: null,
                      }}
                      label={t.settings.chooseTheFile}
                      onPicked={closeAdd}
                    />
                  )}
                </td>
                <td className={`${cell} text-right`}>
                  <button
                    type="button"
                    className={INLINE_ICON_BUTTON}
                    title={t.settings.cancel}
                    aria-label={t.settings.cancel}
                    onClick={closeAdd}
                  >
                    <X width={14} height={14} />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
      {!adding && (
        <div>
          <button
            type="button"
            className={`${FORM_BUTTON} gap-1.5`}
            onClick={() => {
              setAdding(true);
              setNumber(suggestions[0] ?? '');
            }}
          >
            <Plus width={14} height={14} />
            {t.settings.addDevice}
          </button>
        </div>
      )}
    </div>
  );
}
