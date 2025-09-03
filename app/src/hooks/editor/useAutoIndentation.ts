import * as monaco_editor from 'monaco-editor';
import { useCallback } from 'react';
import { autoIndentLine } from '@/lib/auto-indent-line';

function applyEdit(
  editor: monaco_editor.editor.IStandaloneCodeEditor,
  monaco: typeof monaco_editor,
  lineNumber: number,
  oldContent: string,
  newContent: string,
) {
  if (oldContent === newContent) return;
  editor.executeEdits('auto-indent', [
    {
      range: new monaco.Range(lineNumber, 1, lineNumber, oldContent.length + 1),
      text: newContent,
      forceMoveMarkers: true,
    },
  ]);
}

export function useAutoIndentation(
  editorRef: React.MutableRefObject<monaco_editor.editor.IStandaloneCodeEditor | null>,
  monaco: typeof monaco_editor | null,
) {
  // CodeEditor에 있던 handleAutoIndent 함수를 가져옵니다.
  const handleAutoIndent = useCallback(
    (lineNumber: number, cursorIndex: number, backspace = false) => {
      const editor = editorRef.current;
      if (!editor || !monaco) return;

      const model = editor.getModel();
      if (!model) return;

      const lineContent = model.getLineContent(lineNumber);
      const newText = autoIndentLine(lineContent, backspace, cursorIndex);

      applyEdit(editor, monaco, lineNumber, lineContent, newText);

      // 커서 위치 재조정
      let newColumn = cursorIndex + 1; // 기본: 기존 위치
      if (newColumn > newText.length + 1) newColumn = newText.length + 1;

      editor.setPosition({ lineNumber, column: newColumn });
    },
    [editorRef, monaco],
  );

  // onKeyDown 이벤트에 연결할 핸들러입니다.
  const handleKeyDown = useCallback(
    (e: monaco_editor.IKeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const editor = editorRef.current;
      if (!editor) return;

      const pos = editor.getPosition();
      if (!pos) return;

      const { lineNumber, column } = pos;
      const cursorIndex = column - 1;

      switch (e.code) {
        case 'Tab':
          e.preventDefault();
          handleAutoIndent(lineNumber, cursorIndex, false);
          break;

        case 'Backspace':
          setTimeout(() => {
            const currentPos = editor.getPosition();
            if (!currentPos) return;
            handleAutoIndent(currentPos.lineNumber, currentPos.column - 1, true);
          }, 0);
          break;

        case 'Enter':
          setTimeout(() => {
            const newPos = editor.getPosition();
            if (!newPos) return;
            handleAutoIndent(newPos.lineNumber - 1, 0, false);
            handleAutoIndent(newPos.lineNumber, 0, false);
          }, 0);
          break;
      }
    },
    [editorRef, handleAutoIndent],
  );

  // onDidPaste 이벤트에 연결할 핸들러입니다.
  const handlePaste = useCallback(
    (e: monaco_editor.editor.IPasteEvent) => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!editor || !model || !monaco) return;

      const edits: monaco_editor.editor.ISingleEditOperation[] = [];
      for (let i = e.range.startLineNumber; i <= e.range.endLineNumber; i++) {
        const content = model.getLineContent(i);
        const newText = autoIndentLine(content, false, 0);
        if (content !== newText) {
          edits.push({
            range: new monaco.Range(i, 1, i, content.length + 1),
            text: newText,
          });
        }
      }
      if (edits.length > 0) {
        editor.executeEdits('auto-indent-paste', edits);
      }
    },
    [editorRef, monaco],
  );

  return { handleKeyDown, handlePaste };
}
