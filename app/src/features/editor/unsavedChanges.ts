import { tabKind, useEditorTabStore } from '@/features/editor/editorTabStore';
import { useProjectStore } from '@/features/project/projectStore';
import { useInfoModalStore } from '@/stores/infoModalStore';

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
  try {
    const res = await window.api.confirmUnsavedChanges(modified.map(tab => tab.title));
    const choice = res.success ? res.data : 'cancel';
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
        useInfoModalStore.getState().show('저장 실패', `${tab.title} 을(를) 저장하지 못했습니다.`);
        return false;
      }
      if (isSettings) setModified(tab.filePath, false);
    }
    return true;
  } finally {
    asking = false;
  }
}

/** Close a tab, asking first if it has unsaved changes. */
export async function requestCloseTab(filePath: string) {
  if (await resolveUnsavedChanges([filePath])) {
    useEditorTabStore.getState().closeTab(filePath);
  }
}
