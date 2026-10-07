// Connecting devices to files (project.sic's filedevices), shared by the settings page, the
// file tree and the notice after a load. Changes are written at once (changeSettings).
import { deviceHex } from '@/features/debugger/lib/deviceUse';
import { useProjectStore } from '@/features/project/projectStore';
import { strings } from '@/i18n';
import { resolveInProject } from '@/lib/projectPath';
import { showError } from '@/stores/dialogStore';
import { notify } from '@/stores/toastStore';

/** A device number as students write it: F1, f1, 0xF1, X'F1'; null if it is not 00–FF. */
export function parseDeviceNumber(text: string): number | null {
  const t = text
    .trim()
    .toUpperCase()
    .replace(/^0X/, '')
    .replace(/^X'(.*)'$/, '$1');
  return /^[0-9A-F]{1,2}$/.test(t) ? parseInt(t, 16) : null;
}

/**
 * A file name for a device's new file: from the symbol naming it (INDEV → indev.txt), else
 * from its number (devF1.txt); with a number added if the project has that name already.
 */
export function suggestedFileName(device: number, labels: string[]): string {
  const taken = new Set(useProjectStore.getState().fileTree.map(f => f.relativePath));
  const base = labels[0] ? labels[0].toLowerCase() : `dev${deviceHex(device)}`;
  let name = `${base}.txt`;
  for (let i = 2; taken.has(name); i++) name = `${base}${i}.txt`;
  return name;
}

/** Connect `device` to `filename` (relative to the project if inside it). */
export function connectDevice(device: number, filename: string) {
  const { settings, changeSettings } = useProjectStore.getState();
  const others = settings.filedevices.filter(d => d.index !== device);
  return changeSettings({
    filedevices: [...others, { index: device, filename }].sort((a, b) => a.index - b.index),
  });
}

/** Create `name` in the project folder (unless it is there) and connect `device` to it. */
export async function connectToNewFile(device: number, name: string): Promise<boolean> {
  const { projectPath, refreshFileTree } = useProjectStore.getState();
  const exists = await window.api.pathExists([resolveInProject(projectPath, name)]);
  if (!(exists.success && exists.data?.[0])) {
    const res = await window.api.createNewFile(projectPath, name);
    if (!res.success) {
      void showError(strings().messages.createFailed, res.message);
      return false;
    }
    refreshFileTree();
  }
  return connectDevice(device, name);
}

/** Disconnect `device`, with an Undo in the notice. */
export async function disconnectDevice(device: number) {
  const { settings, changeSettings } = useProjectStore.getState();
  const removed = settings.filedevices.find(d => d.index === device);
  if (!removed) return;
  const ok = await changeSettings({
    filedevices: settings.filedevices.filter(d => d.index !== device),
  });
  if (!ok) return;
  const t = strings();
  notify('info', t.settings.disconnected(deviceHex(device), removed.filename), {
    label: t.settings.undo,
    run: () => void connectDevice(removed.index, removed.filename),
  });
}
