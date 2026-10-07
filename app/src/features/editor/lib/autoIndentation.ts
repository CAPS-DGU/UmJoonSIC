import * as monaco from 'monaco-editor';
import { TabFocus } from 'monaco-editor/esm/vs/editor/browser/config/tabFocus.js';
import {
  formatLine,
  formatPasted,
  onBackspace,
  onEnter,
  onShiftTab,
  onSpace,
  type Edit,
} from '@/features/editor/lib/sicxeFormat';

type Editor = monaco.editor.IStandaloneCodeEditor;

/**
 * Column alignment of SIC/XE source in the editor (the rules are in sicxeFormat.ts):
 * - Space and Tab go to the next column; Shift+Tab to the field before;
 * - Backspace in the padding moves back over it; Enter lays out the line and starts the next
 *   one at the operation's column;
 * - a line edited by typing is laid out (and corrected) when the cursor leaves it;
 * - pasted lines are laid out as a block.
 * The keys are handled at once, not after the editor has applied them: fast typing cannot
 * overtake the alignment. Applies while `isEnabled()` is true (the project's .asm files).
 * Returns a disposer.
 */
export function attachAutoIndentation(editor: Editor, isEnabled: () => boolean) {
  let ownEdit = false;
  /**
   * The line being edited by typing, laid out when the cursor leaves it. A decoration (drawn
   * as nothing), so that it follows its line when lines are added or removed above it.
   */
  let edited: string[] = [];
  const markEdited = (lineNumber: number | null) => {
    const model = editor.getModel();
    if (!model) return;
    edited = model.deltaDecorations(
      edited,
      lineNumber === null
        ? []
        : [
            {
              range: new monaco.Range(lineNumber, 1, lineNumber, 1),
              options: {
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              },
            },
          ],
    );
  };
  /**
   * The marker is moved in a microtask, never inside an editor event: Monaco can deliver
   * queued events while a decoration change is running, and changing decorations from such
   * an event is a recursion it reports ("Invoking deltaDecorations recursively").
   */
  let pending: number | null | undefined;
  const setEdited = (lineNumber: number | null) => {
    if (pending === undefined) queueMicrotask(flushEdited);
    pending = lineNumber;
  };
  const flushEdited = () => {
    if (pending === undefined) return;
    const lineNumber = pending;
    pending = undefined;
    markEdited(lineNumber);
  };
  const editedLine = () =>
    pending !== undefined
      ? pending
      : edited.length
        ? (editor.getModel()?.getDecorationRange(edited[0])?.startLineNumber ?? null)
        : null;

  const lineRange = (model: monaco.editor.ITextModel, lineNumber: number) =>
    new monaco.Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber));

  /** Replace one line and put the cursor where the formatter says (0-based index). */
  const apply = (lineNumber: number, edit: Edit) => {
    const model = editor.getModel();
    if (!model) return;
    const column = edit.cursor + 1;
    ownEdit = true;
    try {
      if (model.getLineContent(lineNumber) !== edit.line) {
        editor.executeEdits(
          'sicxe-format',
          [{ range: lineRange(model, lineNumber), text: edit.line }],
          [new monaco.Selection(lineNumber, column, lineNumber, column)],
        );
      } else {
        editor.setPosition({ lineNumber, column });
      }
    } finally {
      ownEdit = false;
    }
  };

  /** Lay out a line the cursor has left, keeping the cursor where it is. */
  const formatLeft = (lineNumber: number) => {
    const model = editor.getModel();
    if (!model || lineNumber > model.getLineCount()) return;
    const content = model.getLineContent(lineNumber);
    const formatted = formatLine(content);
    if (formatted === content) return;
    ownEdit = true;
    try {
      editor.executeEdits('sicxe-format', [
        { range: lineRange(model, lineNumber), text: formatted },
      ]);
    } finally {
      ownEdit = false;
    }
  };

  const suggestionOpen = () => !!editor.getDomNode()?.querySelector('.suggest-widget.visible');

  const onKeyDown = editor.onKeyDown(e => {
    if (!isEnabled() || e.ctrlKey || e.metaKey || e.altKey) return;
    // A Korean (or other) input method is composing: the key is its, not ours.
    if (e.browserEvent.isComposing || e.keyCode === monaco.KeyCode.KEY_IN_COMPOSITION) return;
    const model = editor.getModel();
    const selections = editor.getSelections();
    const pos = editor.getPosition();
    if (!model || !pos || !selections || selections.length !== 1) return;
    // With a selection, the editor's own behaviour (replace, indent, delete).
    if (!selections[0].isEmpty()) return;

    const { lineNumber, column } = pos;
    const content = model.getLineContent(lineNumber);
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };

    switch (e.code) {
      case 'Tab': {
        // Monaco's "Tab moves focus" (Ctrl+M, as in VS Code): Tab leaves the editor, the
        // way out for keyboard users. With the word suggestion open, Tab accepts it.
        if (TabFocus.getTabFocusMode() || suggestionOpen()) return;
        handled();
        apply(
          lineNumber,
          e.shiftKey ? onShiftTab(content, column - 1) : onSpace(content, column - 1, true),
        );
        return;
      }
      case 'Space': {
        if (e.shiftKey) return;
        handled();
        apply(lineNumber, onSpace(content, column - 1));
        return;
      }
      case 'Backspace': {
        const edit = onBackspace(content, column - 1);
        if (!edit) return;
        handled();
        apply(lineNumber, edit);
        return;
      }
      case 'Enter':
      case 'NumpadEnter': {
        // At column 1 a line is only opened above: the editor's own Enter.
        if (column === 1 || e.shiftKey) return;
        handled();
        const { before, after, cursor } = onEnter(content, column - 1);
        const eol = model.getEOL();
        ownEdit = true;
        try {
          editor.executeEdits(
            'sicxe-format',
            [{ range: lineRange(model, lineNumber), text: before + eol + after }],
            [new monaco.Selection(lineNumber + 1, cursor + 1, lineNumber + 1, cursor + 1)],
          );
        } finally {
          ownEdit = false;
        }
        setEdited(null);
        return;
      }
    }
  });

  // What the user typed: the line is laid out when the cursor leaves it. Undo and redo are
  // left as they are (laying them out again would fight them).
  const onContent = editor.onDidChangeModelContent(e => {
    if (ownEdit || !isEnabled()) return;
    if (e.isUndoing || e.isRedoing || e.isFlush) {
      setEdited(null);
      return;
    }
    // A change within one line (typing, or a paste of a part of a line).
    const change = e.changes.length === 1 ? e.changes[0] : null;
    if (
      change &&
      change.range.startLineNumber === change.range.endLineNumber &&
      !/[\r\n]/.test(change.text)
    ) {
      const line = change.range.startLineNumber;
      const before = editedLine();
      if (before !== null && before !== line) queueMicrotask(() => formatLeft(before));
      setEdited(line);
    }
  });

  // After the cursor event (the editor is still applying the move): lay out the line left.
  const onCursor = editor.onDidChangeCursorPosition(() => {
    queueMicrotask(() => {
      const left = editedLine();
      const now = editor.getPosition()?.lineNumber;
      if (left === null || left === now) return;
      setEdited(null);
      if (isEnabled()) formatLeft(left);
    });
  });

  /**
   * Pasted lines, laid out as a block (line numbers dropped, the block moved left). A paste
   * within one line is like typing: laid out when the cursor leaves the line.
   */
  const onPaste = editor.onDidPaste(e => {
    const model = editor.getModel();
    if (!isEnabled() || !model || e.range.startLineNumber === e.range.endLineNumber) return;
    const first = e.range.startLineNumber;
    const lines: string[] = [];
    for (let i = first; i <= e.range.endLineNumber; i++) lines.push(model.getLineContent(i));
    const formatted = formatPasted(lines);
    const edits = formatted.flatMap((text, i) =>
      text === lines[i] ? [] : [{ range: lineRange(model, first + i), text }],
    );
    if (edits.length === 0) return;
    ownEdit = true;
    try {
      editor.executeEdits('sicxe-format-paste', edits);
    } finally {
      ownEdit = false;
    }
  });

  return () => {
    onKeyDown.dispose();
    onContent.dispose();
    onCursor.dispose();
    onPaste.dispose();
    markEdited(null);
  };
}

/** Format Document and Format Selection (Shift+Alt+F) for SIC/XE files. */
export function registerSicxeFormatting(languageId: string) {
  const edits = (model: monaco.editor.ITextModel, from: number, to: number) => {
    const out: monaco.languages.TextEdit[] = [];
    for (let i = from; i <= to; i++) {
      const content = model.getLineContent(i);
      const text = formatLine(content);
      if (text !== content)
        out.push({ range: new monaco.Range(i, 1, i, content.length + 1), text });
    }
    return out;
  };
  const document = monaco.languages.registerDocumentFormattingEditProvider(languageId, {
    provideDocumentFormattingEdits: model => edits(model, 1, model.getLineCount()),
  });
  const range = monaco.languages.registerDocumentRangeFormattingEditProvider(languageId, {
    provideDocumentRangeFormattingEdits: (model, r) =>
      edits(model, r.startLineNumber, r.endLineNumber),
  });
  return () => {
    document.dispose();
    range.dispose();
  };
}
