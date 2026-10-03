import { tabKind, useEditorTabStore } from '@/features/editor/editorTabStore';
import { useProjectStore } from '@/features/project/projectStore';

/**
 * Before changes would be lost (closing a tab, the project or the window), ask the user
 * whether to save them. Resolves to true when it is fine to go on: nothing was modified,
 * the changes were saved, or the user chose not to save. False means cancel.
 * `filePaths` limits the question to those tabs; by default every tab counts.
 */
export async function resolveUnsavedChanges(filePaths?: string[]): Promise<boolean> {
  const modified = useEditorTabStore
    .getState()
    .tabs.filter(tab => tab.isModified && (!filePaths || filePaths.includes(tab.filePath)));
  if (modified.length === 0) return true;

  const res = await window.api.confirmUnsavedChanges(modified.map(tab => tab.title));
  const choice = res.success ? res.data : 'cancel';
  if (choice === 'discard') return true;
  if (choice !== 'save') return false;

  // Saving can fail (a read-only file, a deleted folder); then nothing is closed.
  const { saveTab, setModified } = useEditorTabStore.getState();
  for (const tab of modified) {
    if (tabKind(tab.filePath) === 'settings') {
      const saved = await useProjectStore.getState().saveSettings();
      if (!saved.success) return false;
      setModified(tab.filePath, false);
    } else if (!(await saveTab(tab.filePath))) {
      return false;
    }
  }
  return true;
}

/** Close a tab, asking first if it has unsaved changes. */
export async function requestCloseTab(filePath: string) {
  if (await resolveUnsavedChanges([filePath])) {
    useEditorTabStore.getState().closeTab(filePath);
  }
}
