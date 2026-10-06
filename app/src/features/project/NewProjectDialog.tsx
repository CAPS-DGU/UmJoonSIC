import { FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MachineMode } from '@shared/ipc';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useProjectStore } from '@/features/project/projectStore';
import { useStrings } from '@/i18n';

/** The folder new projects went to last time (per user). */
const LOCATION_KEY = 'umjoonsic.newProjectLocation';

function readLocation() {
  try {
    return localStorage.getItem(LOCATION_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * New Project in one dialog: the name, the machine (SIC or SIC/XE) and where the folder goes.
 * It replaces two native dialogs in a row (a folder picker, then a save browser for the name),
 * and lets the machine be chosen at the start.
 */
export default function NewProjectDialog() {
  const t = useStrings();
  const open = useProjectStore(s => s.newProjectOpen);
  const close = useProjectStore(s => s.closeNewProject);
  const createProjectAt = useProjectStore(s => s.createProjectAt);
  const [name, setName] = useState('');
  const [location, setLocation] = useState(readLocation);
  const [mode, setMode] = useState<MachineMode>(useMemoryViewStore.getState().mode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setError('');
      setMode(useMemoryViewStore.getState().mode);
    }
  }, [open]);

  if (!open) return null;

  const browse = async () => {
    const res = await window.api.pickFolder(t.newProject.chooseLocation, location || undefined);
    if (res.success && res.data) {
      setLocation(res.data);
      setError('');
    }
  };

  const create = async () => {
    if (!name.trim()) return setError(t.messages.nameEmpty);
    if (!location) return setError(t.messages.noFolder);
    setBusy(true);
    const res = await createProjectAt(location, name.trim(), mode);
    setBusy(false);
    if (res.success) {
      try {
        localStorage.setItem(LOCATION_KEY, location);
      } catch {
        // Only a convenience.
      }
      return;
    }
    if (res.code === 'canceled') return;
    const messages: Record<string, string> = {
      emptyName: t.messages.nameEmpty,
      badName: t.messages.nameBad,
      exists: t.messages.nameExists(name.trim()),
      noFolder: t.messages.noFolder,
    };
    setError(messages[res.code ?? ''] ?? res.message ?? t.messages.createFailed);
  };

  const target = location && name.trim() ? `${location.replace(/[\\/]$/, '')}/${name.trim()}` : '';

  return (
    <Dialog open onOpenChange={next => !next && close()}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t.newProject.title}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4 text-sm"
          onSubmit={e => {
            e.preventDefault();
            void create();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-gray-800">{t.newProject.name}</span>
            <Input
              autoFocus
              value={name}
              placeholder={t.newProject.namePlaceholder}
              aria-invalid={!!error}
              onChange={e => {
                setName(e.target.value);
                setError('');
              }}
            />
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 font-medium text-gray-800">{t.newProject.machine}</legend>
            <div className="flex gap-2">
              {(['SIC', 'SICXE'] as MachineMode[]).map(value => (
                <label
                  key={value}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 font-medium ${
                    mode === value
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="newProjectMode"
                    className="sr-only"
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  {value === 'SICXE' ? t.run.sicxe : t.run.sic}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-gray-800">{t.newProject.location}</span>
            <div className="flex gap-2">
              <div
                className={`flex h-9 min-w-0 flex-1 items-center truncate rounded-md border border-gray-300 bg-gray-50 px-3 font-mono text-xs ${
                  location ? 'text-gray-900' : 'text-gray-600'
                }`}
                title={location}
              >
                {location || t.newProject.noLocation}
              </div>
              <Button type="button" variant="outline" onClick={() => void browse()}>
                <FolderOpen />
                {t.common.browse}
              </Button>
            </div>
            {target && (
              <span className="truncate text-xs text-gray-600" title={target}>
                {t.newProject.willCreate(target)}
              </span>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {t.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
