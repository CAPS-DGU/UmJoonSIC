import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { DeviceAccess } from '@/features/debugger/lib/deviceUse';
import { parseDeviceNumber } from '@/features/project/deviceSettings';
import { useStrings } from '@/i18n';

/** A new file's options: one checkbox per file type. */
export interface NewFileOptions {
  /** The place a new .asm file would take in the assembled files ("3rd"). */
  assembleOrdinal: string;
  /** Device numbers to offer for a .txt file: used by the program but not connected first. */
  deviceSuggestions: string[];
  /** How the program uses each device (by its hex number), for the line under the field. */
  deviceUses: Record<string, DeviceAccess[]>;
}

/** What the user chose: assemble the .asm file; connect the .txt file to this device. */
export interface NewFileChoice {
  assemble: boolean;
  device: number | null;
}

interface NameDialogProps {
  open: boolean;
  title: string;
  /** A line under the title (e.g. the folder the file goes into). */
  hint?: string;
  label: string;
  initial?: string;
  submitLabel: string;
  /** File types to choose from (e.g. ['.asm', '.txt']); none for folders and renames. */
  extensions?: string[];
  /** A new file: the options of its type. */
  fileOptions?: NewFileOptions;
  onClose: () => void;
  /** Resolves to an error to show under the field, or null when done. */
  onSubmit: (name: string, extension: string, choice: NewFileChoice) => Promise<string | null>;
}

/** Asks for a name: new file (with its type), new folder, rename. Errors show under the field. */
export function NameDialog({
  open,
  title,
  hint,
  label,
  initial = '',
  submitLabel,
  extensions,
  fileOptions,
  onClose,
  onSubmit,
}: NameDialogProps) {
  const t = useStrings();
  const [name, setName] = useState(initial);
  const [extension, setExtension] = useState(extensions?.[0] ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // An .asm file is assembled unless unticked (as before); a .txt file is connected if ticked.
  const [assemble, setAssemble] = useState(true);
  const [connect, setConnect] = useState(false);
  const [deviceText, setDeviceText] = useState(fileOptions?.deviceSuggestions[0] ?? 'F1');

  useEffect(() => {
    if (open) {
      setName(initial);
      setExtension(extensions?.[0] ?? '');
      setError('');
      setAssemble(true);
      setConnect(false);
      setDeviceText(fileOptions?.deviceSuggestions[0] ?? 'F1');
    }
    // `extensions` is a fresh array on every render; the first one is all that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  if (!open) return null;

  // The type a typed name ends with wins over the type buttons (as on submit).
  const typedExt = /\.(asm|txt)$/i.exec(name.trim())?.[0].toLowerCase();
  const effectiveExt = typedExt ?? extension;
  const device = parseDeviceNumber(deviceText);
  const deviceHexText = device === null ? '' : device.toString(16).toUpperCase().padStart(2, '0');
  const uses = fileOptions?.deviceUses[deviceHexText] ?? [];

  const submit = async () => {
    if (!name.trim()) return setError(t.messages.nameEmpty);
    const connecting = !!fileOptions && effectiveExt === '.txt' && connect;
    if (connecting && device === null) return setError(t.settings.badNumber);
    setBusy(true);
    const problem = await onSubmit(name.trim(), extension, {
      assemble: !!fileOptions && effectiveExt === '.asm' && assemble,
      device: connecting ? device : null,
    });
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={next => !next && onClose()}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {hint && (
            <p className="truncate text-xs text-gray-600" title={hint}>
              {hint}
            </p>
          )}
        </DialogHeader>
        <form
          className="flex flex-col gap-3 text-sm"
          onSubmit={e => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-gray-800">{label}</span>
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={name}
                aria-invalid={!!error}
                onChange={e => {
                  setName(e.target.value);
                  setError('');
                }}
                onFocus={e => {
                  // On rename, select the name without its extension, as file managers do.
                  const dot = e.target.value.lastIndexOf('.');
                  if (initial && dot > 0) e.target.setSelectionRange(0, dot);
                }}
              />
              {extensions && extensions.length > 0 && (
                <div
                  className="flex shrink-0 rounded-md border border-gray-300 p-0.5"
                  role="radiogroup"
                  aria-label={t.files.fileType}
                >
                  {extensions.map(ext => (
                    <button
                      key={ext}
                      type="button"
                      role="radio"
                      aria-checked={extension === ext}
                      onClick={() => setExtension(ext)}
                      className={`rounded px-2 py-1 font-mono text-xs ${
                        extension === ext
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-800 hover:bg-gray-100'
                      }`}
                    >
                      {ext}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {error && (
              <span className="text-sm text-red-600" role="alert">
                {error}
              </span>
            )}
          </label>
          {fileOptions && effectiveExt === '.asm' && (
            <label className="flex items-center gap-2" data-new-file-option="assemble">
              <input
                type="checkbox"
                className="size-4 accent-blue-600"
                checked={assemble}
                onChange={e => setAssemble(e.target.checked)}
              />
              {t.files.addToAsmOption(fileOptions.assembleOrdinal)}
            </label>
          )}
          {fileOptions && effectiveExt === '.txt' && (
            <div className="flex flex-col gap-1" data-new-file-option="device">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-blue-600"
                    checked={connect}
                    onChange={e => setConnect(e.target.checked)}
                  />
                  {t.files.connectOption}
                </label>
                <input
                  list="new-file-devices"
                  aria-label={t.settings.deviceNumber}
                  disabled={!connect}
                  className="h-7 w-16 rounded-md border border-gray-300 bg-white px-2 text-center font-mono uppercase disabled:opacity-50"
                  value={deviceText}
                  onChange={e => setDeviceText(e.target.value)}
                />
                <datalist id="new-file-devices">
                  {fileOptions.deviceSuggestions.map(d => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
              {connect && (uses.includes('read') || uses.includes('write')) && (
                <span className="text-xs text-gray-600">
                  {uses.includes('read') ? t.files.readsHint : t.files.writesHint}
                </span>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
