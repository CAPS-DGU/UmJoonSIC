import type * as monaco_editor from 'monaco-editor';

/** Options applied to the code editor once its font has loaded. */
export const editorOptions: monaco_editor.editor.IStandaloneEditorConstructionOptions = {
  // Nothing is drawn beside the line numbers (errors are underlined and their lines tinted).
  glyphMargin: false,
  lineNumbers: 'on',
  folding: true,
  minimap: { enabled: true },
  scrollBeyondLastLine: true,
  renderLineHighlight: 'all',
  selectOnLineNumbers: true,

  // Fixed-width layout: SIC/XE source is column-oriented.
  fontFamily: 'JetBrains Mono',
  fontSize: 12,
  letterSpacing: 0,
  tabSize: 8,
  insertSpaces: true,
  rulers: [9, 17, 35], // end of the label, opcode and operand fields
  wordWrap: 'off',

  // Monaco's own indenting and formatting are off: useAutoIndentation does the column alignment.
  autoIndent: 'none',
  formatOnType: false,
  formatOnPaste: false,
  tabCompletion: 'off',
};
