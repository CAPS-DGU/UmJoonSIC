import { useEffect, type MutableRefObject } from 'react';
import type * as monaco from 'monaco-editor';
import { selectActiveTab, useEditorTabStore } from '@/features/editor/editorTabStore';
import { checkSyntax, isProjectAsmFile } from '@/features/editor/lib/syntaxCheck';
import { useInfoModalStore } from '@/stores/infoModalStore';

/**
 * Delay between Ctrl+S and saving. It gives an input-method composition in progress
 * (Hangul) time to be committed to the text first.
 */
const SAVE_DELAY_MS = 100;

/** Ctrl/Cmd+S while the code editor is shown: save the active file and check its syntax. */
export function useEditorShortcuts(
  editorRef: MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      event.stopPropagation();

      const activeTab = selectActiveTab(useEditorTabStore.getState());
      if (!activeTab || !editorRef.current) return;
      const { filePath } = activeTab;
      setTimeout(() => {
        const { tabs, saveTab } = useEditorTabStore.getState();
        const tab = tabs.find(t => t.filePath === filePath);
        if (!tab) return;
        if (isProjectAsmFile(filePath)) {
          checkSyntax([tab.content], [filePath]);
        }
        void saveTab(filePath).then(saved => {
          if (!saved) {
            useInfoModalStore
              .getState()
              .show('저장 실패', `${tab.title} 을(를) 저장하지 못했습니다.`);
          }
        });
      }, SAVE_DELAY_MS);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorRef]);
}
