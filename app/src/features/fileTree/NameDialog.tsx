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
import { useStrings } from '@/i18n';

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
  onClose: () => void;
  /** Resolves to an error to show under the field, or null when done. */
  onSubmit: (name: string, extension: string) => Promise<string | null>;
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
  onClose,
  onSubmit,
}: NameDialogProps) {
  const t = useStrings();
  const [name, setName] = useState(initial);
  const [extension, setExtension] = useState(extensions?.[0] ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial);
      setExtension(extensions?.[0] ?? '');
      setError('');
    }
    // `extensions` is a fresh array on every render; the first one is all that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  if (!open) return null;

  const submit = async () => {
    if (!name.trim()) return setError(t.messages.nameEmpty);
    setBusy(true);
    const problem = await onSubmit(name.trim(), extension);
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
