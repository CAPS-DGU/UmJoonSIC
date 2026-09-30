import { useEffect, type MutableRefObject } from 'react';
import type * as monaco_editor from 'monaco-editor';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { checkSyntax, isProjectAsmFile } from '@/features/editor/lib/syntaxCheck';
import { useProjectStore } from '@/features/project/projectStore';

/**
 * Delay between Ctrl+S and reading the editor's content. Kept from the original code;
 * it also gives an input-method composition in progress (Hangul) time to be committed.
 */
const SAVE_DELAY_MS = 100;

const ZOOM_KEYS = ['+', '-', '=', '0'];

/**
 * Window-level keyboard handling while the code editor is shown:
 * Ctrl/Cmd+S saves the active file (and checks its syntax); any other key typed
 * into the editor schedules a syntax check.
 */
export function useEditorShortcuts(
  editorRef: MutableRefObject<monaco_editor.editor.IStandaloneCodeEditor | null>,
  scheduleSyntaxCheck: (texts: string[], fileNames: string[]) => void,
) {
  const getActiveTab = useEditorTabStore(state => state.getActiveTab);
  const setIsModified = useEditorTabStore(state => state.setIsModified);
  const { projectPath } = useProjectStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const editor = editorRef.current;
      const isCommand = event.ctrlKey || event.metaKey;

      // Zoom shortcuts belong to Electron's View menu.
      if (isCommand && ZOOM_KEYS.includes(event.key)) {
        return;
      }

      if (isCommand && event.key.toLowerCase() === 's') {
        event.preventDefault();
        event.stopPropagation();

        const activeTab = getActiveTab();
        if (activeTab && editor) {
          setTimeout(() => {
            const content = editor.getValue();
            if (isProjectAsmFile(activeTab.filePath)) {
              checkSyntax([content], [activeTab.filePath]);
            }
            window.api.saveFile(projectPath + '/' + activeTab.filePath, content).then(res => {
              if (res.success) {
                setIsModified(activeTab.idx, false);
              } else {
                console.error('Failed to save file:', res.message);
              }
            });
          }, SAVE_DELAY_MS);
        }
        return;
      }

      if (editor && editor.hasTextFocus()) {
        const activeTab = getActiveTab();
        if (activeTab && isProjectAsmFile(activeTab.filePath)) {
          scheduleSyntaxCheck([editor.getValue()], [activeTab.filePath]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorRef, getActiveTab, projectPath, setIsModified, scheduleSyntaxCheck]);
}
