import * as monaco_editor from 'monaco-editor';

/** The line number, limited to the lines the model has (1 to its line count). */
export const clampLine = (line: number, model: monaco_editor.editor.ITextModel) => {
  return Math.max(1, Math.min(line ?? 1, model.getLineCount()));
};
