import { useEffect, useRef, type MutableRefObject } from 'react';
import type * as monaco_editor from 'monaco-editor';
import type { EditorTab } from '@/features/editor/editorTabStore';
import { clampLine } from '@/features/editor/lib/clampLine';
import { SICXE_LANGUAGE_ID } from '@/features/editor/monaco/sicxe';
import { useErrorStore } from '@/features/panel/errorStore';

/**
 * Show the active file's errors in the editor: a squiggle under each error, and
 * a highlighted line for the errors reported when the program was loaded.
 */
export function useErrorMarkers(
  editorRef: MutableRefObject<monaco_editor.editor.IStandaloneCodeEditor | null>,
  monaco: typeof monaco_editor | null,
  activeTab: EditorTab | undefined,
) {
  const errors = useErrorStore(state => state.errors);
  const loadErrorDecorationIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTab || !errors) return;
    const model = editor.getModel();
    if (!model || !monaco) return;

    const fileErrors = errors[activeTab.filePath];
    if (!fileErrors?.length) {
      monaco.editor.setModelMarkers(model, SICXE_LANGUAGE_ID, []);
      if (loadErrorDecorationIdsRef.current.length > 0) {
        loadErrorDecorationIdsRef.current = editor.deltaDecorations(
          loadErrorDecorationIdsRef.current,
          [],
        );
      }
      return;
    }

    const markers = fileErrors.map(err => {
      const line = clampLine(err.row, model);
      const maxColumn = model.getLineMaxColumn(line);
      return {
        severity: monaco.MarkerSeverity.Error,
        message: err.message,
        startLineNumber: line,
        startColumn: Math.max(1, Math.min(err.col, maxColumn)),
        endLineNumber: line,
        endColumn: Math.max(1, Math.min(err.col + (err.length ?? 1), maxColumn)),
      };
    });
    monaco.editor.setModelMarkers(model, SICXE_LANGUAGE_ID, markers);

    const loadErrorDecorations = fileErrors
      .filter(err => err.type === 'load')
      .map(err => clampLine(err.row, model))
      .map(line => ({
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: 'load-error-line' },
      }));
    loadErrorDecorationIdsRef.current = editor.deltaDecorations(
      loadErrorDecorationIdsRef.current,
      loadErrorDecorations,
    );
    // Re-run when the errors or the active tab change; the tab object itself changes on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors, activeTab?.idx, monaco]);
}
