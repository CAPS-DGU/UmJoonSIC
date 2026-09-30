import { useCallback, type MutableRefObject } from 'react';
import type * as monaco_editor from 'monaco-editor';
import { autoIndentLine } from '@/features/editor/lib/autoIndentLine';

type Editor = monaco_editor.editor.IStandaloneCodeEditor;
type Monaco = typeof monaco_editor;

interface ReindentOptions {
  /** The key was Backspace (already applied by the editor). */
  backspace?: boolean;
  /** The key was Space or Tab. */
  space?: boolean;
  /** What Backspace removed; null for other keys. */
  erased?: string | null;
}

/**
 * Column alignment for SIC/XE source (label / opcode / operand / comment) as the user
 * types: Tab and Space step to the next column, Enter aligns the line just left,
 * Backspace collapses padding, and pasted lines are aligned as a whole.
 */
export function useAutoIndentation(
  editorRef: MutableRefObject<Editor | null>,
  monaco: Monaco | null,
) {
  /** Re-align one line and, if it became empty, put the cursor where the formatter says. */
  const reindentLine = useCallback(
    (lineNumber: number, cursorIndex: number, options: ReindentOptions = {}) => {
      const { backspace = false, space = false, erased = null } = options;
      const editor = editorRef.current;
      if (!editor || !monaco) return;

      const model = editor.getModel();
      if (!model) return;

      const lineContent = model.getLineContent(lineNumber);
      // Enter on an empty line: nothing to align.
      if (!backspace && !space && lineContent.length === 0) {
        return;
      }

      // The formatter leaves a line with a selection alone; a multi-line selection is skipped here.
      const sel = editor.getSelection();
      let selStart: number | undefined;
      let selEnd: number | undefined;
      if (sel) {
        if (sel.startLineNumber !== sel.endLineNumber) return;
        // Monaco columns are 1-based; the formatter takes 0-based indexes.
        selStart = Math.max(0, sel.startColumn - 1);
        selEnd = Math.max(0, sel.endColumn - 1);
      }

      const { line: newLine, cursor: newCursor } = autoIndentLine(
        lineContent,
        backspace,
        space,
        cursorIndex,
        selStart,
        selEnd,
        erased,
      );

      if (newLine !== lineContent) {
        editor.executeEdits('auto-indent', [
          {
            range: new monaco.Range(lineNumber, 1, lineNumber, lineContent.length + 1),
            text: newLine,
            forceMoveMarkers: true,
          },
        ]);
      }

      if (!newLine) {
        const column = Math.max(0, Math.min(newCursor, newLine.length)) + 1;
        editor.setPosition({ lineNumber, column });
      }
    },
    [editorRef, monaco],
  );

  /** For the editor's onKeyDown. Runs before Monaco applies the key. */
  const handleKeyDown = useCallback(
    (e: monaco_editor.IKeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const editor = editorRef.current;
      if (!editor || !monaco) return;
      const model = editor.getModel();
      if (!model) return;
      const pos = editor.getPosition();
      if (!pos) return;

      const { lineNumber, column } = pos;

      /** Re-align the line the cursor is on, after Monaco has applied the key. */
      const reindentAfterEdit = (options: ReindentOptions) => {
        setTimeout(() => {
          const currentPos = editor.getPosition();
          if (!currentPos) return;
          reindentLine(currentPos.lineNumber, currentPos.column - 1, options);
        }, 0);
      };

      switch (e.code) {
        case 'Tab': {
          // Tab never inserts a tab character: it steps to the next column.
          e.preventDefault();
          e.stopPropagation();
          reindentLine(lineNumber, column - 1, { space: true });
          break;
        }

        case 'Backspace': {
          // Work out now, before Monaco deletes it, what is about to be erased.
          const sel = editor.getSelection();
          const hasSelection =
            sel && (sel.startLineNumber !== sel.endLineNumber || sel.startColumn !== sel.endColumn);
          const readRange = (sl: number, sc: number, el: number, ec: number) =>
            model.getValueInRange(new monaco.Range(sl, sc, el, ec));

          let erased = '';
          if (hasSelection && sel) {
            erased =
              readRange(sel.startLineNumber, sel.startColumn, sel.endLineNumber, sel.endColumn) ||
              '';
          } else if (column > 1) {
            erased = readRange(lineNumber, column - 1, lineNumber, column) || '';
          }
          reindentAfterEdit({ backspace: true, erased });
          break;
        }

        case 'Space': {
          reindentAfterEdit({ space: true });
          break;
        }

        case 'Enter': {
          // Align the line that was just left (the cursor is on the new line by then).
          setTimeout(() => {
            const newPos = editor.getPosition();
            if (!newPos) return;
            reindentLine(newPos.lineNumber - 1, 0);
          }, 0);
          break;
        }
      }
    },
    [editorRef, monaco, reindentLine],
  );

  /** For the editor's onDidPaste: align every pasted line. */
  const handlePaste = useCallback(
    (e: monaco_editor.editor.IPasteEvent) => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!editor || !model || !monaco) return;

      const edits: monaco_editor.editor.ISingleEditOperation[] = [];
      for (let i = e.range.startLineNumber; i <= e.range.endLineNumber; i++) {
        const content = model.getLineContent(i);
        const { line: newText } = autoIndentLine(content);
        if (content !== newText) {
          edits.push({ range: new monaco.Range(i, 1, i, content.length + 1), text: newText });
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
