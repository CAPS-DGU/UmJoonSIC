import { useEffect, useRef } from 'react';
import { useEditorTabStore, type EditorTab } from '@/features/editor/editorTabStore';

/**
 * Read the active tab's file from disk whenever the tab (or the project) changes.
 * Returns a ref that is true while that read is in progress, so the editor can tell
 * "content arrived from disk" from "the user typed".
 */
export function useFileContent(activeTab: EditorTab | undefined, projectPath: string) {
  const setFileContent = useEditorTabStore(state => state.setFileContent);
  const setIsModified = useEditorTabStore(state => state.setIsModified);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (!activeTab || !activeTab.filePath || !projectPath) return;

    isLoadingRef.current = true;
    window.api
      .readFile(projectPath + '/' + activeTab.filePath)
      .then(res => {
        if (res.success && res.data) {
          setFileContent(activeTab.idx, res.data);
          setIsModified(activeTab.idx, false);
        } else {
          console.error('Failed to load file:', res.message);
        }
      })
      .catch(console.error)
      .finally(() => {
        isLoadingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.idx, activeTab?.filePath, projectPath]);

  return isLoadingRef;
}
