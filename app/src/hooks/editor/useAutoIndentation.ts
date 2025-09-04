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
    (
      lineNumber: number,
      cursorIndex: number,
      backspace = false,
      space = false,
      // NEW: minimal intercept data captured synchronously in keydown
      erased: string | null = null,          // 어떤 문자가 지워졌는지 (Backspace 시), 없으면 null
      lineChanged: boolean = false,          // Enter/Backspace 등으로 라인 수가 변했는지
      prevPos?: { lineNumber: number; column: number }, // 변경 이전 커서 위치(옵션)
    ) => {
      const editor = editorRef.current;
      if (!editor || !monaco) return;

      const model = editor.getModel();
      if (!model) return;

      // Current line text (Monaco lines DO NOT include '\n')
      const lineContent = model.getLineContent(lineNumber);
      // 빈 줄을 개행했을 때는 포매팅 적용 x
      if (!backspace && !space && lineContent.length === 0) {
        return;
      }
      // Selection (we'll pass it so autoIndentLine can early-out if non-empty)
      const sel = editor.getSelection();
      let selStart: number | undefined;
      let selEnd: number | undefined;

      if (sel) {
        // If selection spans multiple lines, we skip formatting entirely.
        const isMultiLine = sel.startLineNumber !== sel.endLineNumber;
        if (isMultiLine) return;

        // Convert selection columns to 0-based indices within this line.
        // Monaco columns are 1-based and inclusive; our function expects 0-based.
        selStart = Math.max(0, sel.startColumn - 1);
        selEnd   = Math.max(0, sel.endColumn   - 1);

        // If it's a non-empty selection on this line, we still pass it so autoIndentLine
        // returns immediately without formatting. (You could also short-circuit here.)
      }

      // Call the new API (returns { line, cursor })
      // NOTE: autoIndentLine 시그니처가 확장되어야 합니다.
      const { line: newLine, cursor: newCursor0 } = autoIndentLine(
        lineContent,
        backspace,
        space,
        cursorIndex, // 0-based index into CURRENT line
        selStart,
        selEnd,
        erased,        // NEW: nullable String erased
        lineChanged,   // NEW: boolean lineChanged (Enter/Backspace 시 true)
        prevPos,       // optional: 이전 커서 위치 (필요 시 사용)
      );

      // If nothing changed, just set the caret (in case the function adjusted it),
      // otherwise apply the edit then set the caret.
      if (newLine !== lineContent) {
        applyEdit(editor, monaco, lineNumber, lineContent, newLine);
      }

      // Clamp and convert 0-based -> Monaco's 1-based column
      const maxLen = newLine.length;
      const clampedCursor0 = Math.max(0, Math.min(newCursor0, maxLen));
      const newColumn = clampedCursor0 + 1;
      if(!newLine)
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

      const model = editor.getModel();
      if (!model) return;

      const pos = editor.getPosition();
      if (!pos) return;

      const { lineNumber, column } = pos;
      const cursorIndex = column - 1;

      // ---- Minimal synchronous intercept (before Monaco mutates) ----
      // prevPos: 변경 이전의 커서 위치
      const prevPos = { lineNumber, column };

      // 현재 선택 상태 (삭제될 텍스트 판별에만 사용)
      const sel = editor.getSelection();
      const hasSelection =
        sel && (sel.startLineNumber !== sel.endLineNumber || sel.startColumn !== sel.endColumn);

      const readRange = (sl: number, sc: number, el: number, ec: number) =>
        model.getValueInRange(new monaco.Range(sl, sc, el, ec));

      let erased: string | null = null;
      let lineChanged = false;
      // ----------------------------------------------------------------

      switch (e.code) {
        case 'Tab': {
          // 라인 수 변화 없음, 삭제 문자 없음
          lineChanged = false;
          e.preventDefault();
          e.stopPropagation();
          handleAutoIndent(lineNumber, cursorIndex, false, true, null, lineChanged, prevPos);
          break;
        }

        case 'Backspace': {
          // Backspace 는 보통 라인 변화 가능(라인 합쳐짐) → lineChanged = true
          lineChanged = true;

          // 무엇이 지워질지 동기적으로 파악
          if (hasSelection && sel) {
            erased = readRange(sel.startLineNumber, sel.startColumn, sel.endLineNumber, sel.endColumn) || '';
          } else {
            // 커서의 왼쪽 한 글자
            if (column > 1) {
              erased = readRange(lineNumber, column - 1, lineNumber, column) || '';
            } else {
              erased = ''; // 라인 시작이면 삭제될 문자가 없을 수 있음
            }
          }

          // 실제 변경은 Monaco 후에 반영
          setTimeout(() => {
            const currentPos = editor.getPosition();
            if (!currentPos) return;
            handleAutoIndent(
              currentPos.lineNumber,
              currentPos.column - 1,
              true,  // backspace
              false, // space
              erased,
              lineChanged,
              prevPos,
            );
          }, 0);
          break;
        }

        case 'Space': {
          // 스페이스는 보통 라인 수 변화 없음
          lineChanged = false;

          setTimeout(() => {
            const currentPos = editor.getPosition();
            if (!currentPos) return;
            handleAutoIndent(
              currentPos.lineNumber,
              currentPos.column - 1,
              false, // backspace
              true,  // space
              null,
              lineChanged,
              prevPos,
            );
          }, 0);
          break;
        }

        case 'Enter': {
          // Enter 는 라인 수 변화 → lineChanged = true
          lineChanged = true;

          // Enter 는 '지워진 문자' 개념이 없으므로 erased = null 로 유지
          setTimeout(() => {
            const newPos = editor.getPosition();
            if (!newPos) return;

            // 일반적으로 이전 라인과 새 라인 모두에 대해 한 번씩 적용
            handleAutoIndent(
              newPos.lineNumber - 1,
              0,
              false, // backspace
              false, // space
              null,
              lineChanged,
              prevPos,
            );/*
            handleAutoIndent(
              newPos.lineNumber,
              0,
              false,
              false,
              null,
              lineChanged,
              prevPos,
            );*/
          }, 0);
          break;
        }
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
        // 전체 포맷팅이므로 커서 위치는 중요하지 않습니다.
        // autoIndentLine 의 확장된 시그니처에 맞춰 기본값 전달
        const { line: newText } = autoIndentLine(
          content,
          false,     // backspace
          false,     // space
          0,         // cursorIndex
          undefined, // selStart
          undefined, // selEnd
          null,      // erased
          false,     // lineChanged
          undefined, // prevPos
        );

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

  // 저장 시 전체 문서를 포맷하는 함수입니다.
  const formatDocument = useCallback(() => {
    /*저장 시에는 포맷팅을 적용하지 않음
    const editor = editorRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();
    const edits: monaco_editor.editor.ISingleEditOperation[] = [];

    for (let i = 1; i <= lineCount; i++) {
      const lineContent = model.getLineContent(i);
      // 전체 포맷팅이므로 커서 위치는 중요하지 않습니다.
      const { line: newText } = autoIndentLine(
        lineContent,
        false,
        false,
        0,
        undefined,
        undefined,
        null,
        false,
        undefined,
      );

      if (lineContent !== newText) {
        edits.push({
          range: new monaco.Range(i, 1, i, lineContent.length + 1),
          text: newText,
          forceMoveMarkers: true,
        });
      }
    }

    if (edits.length > 0) {
      editor.executeEdits('format-document', edits);
    }*/
  }, [editorRef, monaco]);

  return { handleKeyDown, handlePaste, formatDocument };
}
