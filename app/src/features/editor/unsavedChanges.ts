import { tabKind, useEditorTabStore } from '@/features/editor/editorTabStore';
import type { UnsavedChangesChoice } from '@shared/ipc';
import { useProjectStore } from '@/features/project/projectStore';
import { strings } from '@/i18n';
import { ask, showError } from '@/stores/dialogStore';

/** The app's dialog: save, don't save, or cancel (Escape). */
function askAboutChanges(fileNames: string[]): Promise<UnsavedChangesChoice> {
  const t = strings();
  return ask<UnsavedChangesChoice>({
    title: t.unsaved.title,
    message:
      fileNames.length === 1 ? t.unsaved.one(fileNames[0]) : t.unsaved.many(fileNames.length),
    detail: `${fileNames.length > 1 ? fileNames.join('\n') + '\n\n' : ''}${t.unsaved.detail}`,
    tone: 'warning',
    buttons: [
      { label: t.common.cancel, value: 'cancel', variant: 'plain' },
      { label: t.unsaved.dontSave, value: 'discard', variant: 'plain' },
      { label: t.unsaved.save, value: 'save', variant: 'primary' },
    ],
    cancelValue: 'cancel',
  });
}

/** A question is on screen; another request to close waits for no second question. */
let asking = false;

/**
 * Before changes would be lost (closing a tab, the project or the window), ask the user
 * whether to save them. Resolves to true when it is fine to go on: nothing was modified,
 * the changes were saved, or the user chose not to save them (they are dropped). False
 * means cancel, also when a save failed or another question is already open.
 * `filePaths` limits the question to those tabs; by default every tab counts.
 */
export async function resolveUnsavedChanges(filePaths?: string[]): Promise<boolean> {
  const modified = useEditorTabStore
    .getState()
    .tabs.filter(tab => tab.isModified && (!filePaths || filePaths.includes(tab.filePath)));
  if (modified.length === 0) return true;
  if (asking) return false;

  asking = true;
  // A window close waits for the answer (the main process would otherwise close after 3 s).
  window.api.setAsking(true);
  try {
    const choice = await askAboutChanges(modified.map(tab => tab.title));
    if (choice === 'cancel') return false;

    const { saveTab, setModified } = useEditorTabStore.getState();
    const { saveSettings, discardSettingsChanges } = useProjectStore.getState();
    for (const tab of modified) {
      const isSettings = tabKind(tab.filePath) === 'settings';
      if (choice === 'discard') {
        // Source edits go with their tab (or the project); the settings form's live in the store.
        if (isSettings) discardSettingsChanges();
        continue;
      }
      const saved = isSettings ? (await saveSettings()).success : await saveTab(tab.filePath);
      if (!saved) {
        // Nothing is closed, so nothing is lost; the user can try again or not save.
        void showError(strings().messages.saveFailed(tab.title));
        return false;
      }
      if (isSettings) setModified(tab.filePath, false);
    }
    return true;
  } finally {
    asking = false;
    window.api.setAsking(false);
  }
}

/** Close a tab, asking first if it has unsaved changes. */
export async function requestCloseTab(filePath: string) {
  // The List tab belongs to the run: closing it stops the run, after asking.
  if (tabKind(filePath) === 'listing') {
    const { useRunningStore } = await import('@/features/debugger/runningStore');
    if (useRunningStore.getState().isRunning) {
      const t = strings();
      const stop = await ask<boolean>({
        title: t.listing.closeTitle,
        message: t.listing.closeMessage,
        buttons: [
          { label: t.common.cancel, value: false },
          { label: t.listing.closeAndStop, value: true, variant: 'primary' },
        ],
        cancelValue: false,
      });
      // Stopping closes the List tab with the run.
      if (stop) await useRunningStore.getState().stopRunning();
      return;
    }
  }
  if (await resolveUnsavedChanges([filePath])) {
    useEditorTabStore.getState().closeTab(filePath);
  }
}
