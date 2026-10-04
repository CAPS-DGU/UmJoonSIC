import { useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { tabPathOfModel } from '@/features/editor/editorTabStore';
import { clampLine } from '@/features/editor/lib/clampLine';
import { SICXE_LANGUAGE_ID } from '@/features/editor/monaco/sicxe';
import { useErrorStore, type CompileError } from '@/features/panel/errorStore';
import { useProjectStore } from '@/features/project/projectStore';

/** CSS class of a line with an error from the last load (syntaxError.css). */
const LOAD_ERROR_LINE = 'load-error-line';

/**
 * Show each open file's errors in its editor model: a squiggle under each error, and a
 * highlighted line for the errors reported when the program was loaded. Applied when the
 * errors change, and to a model when it is created (a file shown for the first time).
 */
export function useErrorMarkers() {
  const errors = useErrorStore(state => state.errors);
  const projectPath = useProjectStore(state => state.projectPath);

  useEffect(() => {
    const apply = (model: monaco.editor.ITextModel, fileErrors: CompileError[]) => {
      monaco.editor.setModelMarkers(
        model,
        SICXE_LANGUAGE_ID,
        fileErrors.map(err => {
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
        }),
      );
      // The model's own decorations are replaced (also ones set while the editor was not
      // shown, so that nothing outlives the errors it was made for).
      const previous = model
        .getAllDecorations()
        .filter(d => d.options.className === LOAD_ERROR_LINE)
        .map(d => d.id);
      const loadErrorLines = fileErrors
        .filter(err => err.type === 'load')
        .map(err => clampLine(err.row, model));
      model.deltaDecorations(
        previous,
        loadErrorLines.map(line => ({
          range: new monaco.Range(line, 1, line, 1),
          options: { isWholeLine: true, className: LOAD_ERROR_LINE },
        })),
      );
    };

    for (const model of monaco.editor.getModels()) {
      const filePath = tabPathOfModel(model.uri.toString());
      if (filePath) apply(model, errors[filePath] ?? []);
    }

    const created = monaco.editor.onDidCreateModel(model => {
      const filePath = tabPathOfModel(model.uri.toString());
      if (filePath) apply(model, useErrorStore.getState().errors[filePath] ?? []);
    });
    return () => created.dispose();
  }, [errors, projectPath]);
}
