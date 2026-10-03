import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import EditorErrorBoundary from '@/features/editor/EditorErrorBoundary';
import { selectActiveTab, useEditorTabStore } from '@/features/editor/editorTabStore';
import { useDebounceFn } from '@/features/editor/hooks/useDebounceFn';
import { useEditorShortcuts } from '@/features/editor/hooks/useEditorShortcuts';
import { useErrorMarkers } from '@/features/editor/hooks/useErrorMarkers';
import { attachAutoIndentation } from '@/features/editor/lib/autoIndentation';
import { checkSyntax, isProjectAsmFile } from '@/features/editor/lib/syntaxCheck';
import { editorOptions } from '@/features/editor/monaco/editorOptions';
import { modelPath } from '@/features/editor/monaco/models';
import { SICXE_LANGUAGE_ID } from '@/features/editor/monaco/sicxe';
import '@/features/editor/monaco/setupMonaco';
import { useProjectStore } from '@/features/project/projectStore';
import '@/features/editor/syntaxError.css';

type MonacoEditor = monaco.editor.IStandaloneCodeEditor;

/** Typing pauses this long before the syntax is checked. */
const SYNTAX_CHECK_DEBOUNCE_MS = 1000;

/**
 * The Monaco editor for the active source tab. One editor instance shows one model per
 * file (see monaco/models.ts), so switching tabs keeps each file's text, undo history,
 * cursor and scroll position.
 */
export default function CodeEditor() {
  const activeTab = useEditorTabStore(selectActiveTab);
  const revealRequest = useEditorTabStore(state => state.revealRequest);
  const projectPath = useProjectStore(state => state.projectPath);

  const editorRef = useRef<MonacoEditor | null>(null);
  /** The file shown, for the editor's event handlers (registered once, on mount). */
  const shownPathRef = useRef<string | null>(null);
  const appliedRevealIdRef = useRef<number | null>(null);

  const debouncedCheckSyntax = useDebounceFn(checkSyntax, SYNTAX_CHECK_DEBOUNCE_MS);
  const activePath = activeTab?.filePath ?? null;

  useEffect(() => {
    shownPathRef.current = activePath;
  }, [activePath]);

  useErrorMarkers();
  useEditorShortcuts(editorRef);

  /** Move the cursor to the position of a pending reveal request for the shown file. */
  const applyRevealRequest = () => {
    const editor = editorRef.current;
    const request = useEditorTabStore.getState().revealRequest;
    if (!editor || !request || request.filePath !== shownPathRef.current) return;
    if (appliedRevealIdRef.current === request.id) return;
    appliedRevealIdRef.current = request.id;
    editor.setPosition({ lineNumber: request.line, column: request.column });
    editor.revealLineInCenter(request.line);
  };

  // A request for a file that is already shown, or one that becomes shown.
  // (The editor swaps the model in its own effect, which runs before this one.)
  useEffect(applyRevealRequest, [revealRequest, activePath]);

  const handleEditorDidMount = (editor: MonacoEditor) => {
    editorRef.current = editor;
    const shownPath = () => shownPathRef.current;
    const isShownModel = (model: monaco.editor.ITextModel | null) => {
      const filePath = shownPath();
      return !!model && !!filePath && model.uri.toString() === modelPath(projectPath, filePath);
    };

    // The column layout depends on the fixed-width font, so apply the options once it is there.
    (async () => {
      try {
        await document.fonts.load(`12px "JetBrains Mono"`);
        editor.updateOptions(editorOptions);
        // measure again on the next tick, with the font in place
        setTimeout(() => editor.layout(), 50);
      } catch (error) {
        console.error('Font loading failed:', error);
        editor.updateOptions(editorOptions);
      }
    })();

    editor.onDidChangeCursorPosition(e => {
      const filePath = shownPath();
      if (filePath) {
        useEditorTabStore
          .getState()
          .setCursor(filePath, { line: e.position.lineNumber, column: e.position.column });
      }
    });

    editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      const filePath = shownPath();
      if (!filePath || !isShownModel(model)) return;
      const value = model!.getValue();
      useEditorTabStore.getState().setContent(filePath, value);
      if (isProjectAsmFile(filePath)) {
        debouncedCheckSyntax([value], [filePath]);
      }
    });

    // Pasted text is checked at once, without the debounce.
    editor.onDidPaste(() => {
      const filePath = shownPath();
      if (!filePath || !isProjectAsmFile(filePath)) return;
      checkSyntax([editor.getValue()], [filePath]);
    });

    // Column alignment applies to the project's .asm files only.
    attachAutoIndentation(editor, () => isProjectAsmFile(shownPath() ?? undefined));

    applyRevealRequest();
  };

  if (!activeTab) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-bold">열려있는 파일이 없습니다. </h1>
        <p className="text-sm text-gray-500">파일을 열어 새로운 탭을 만드세요</p>
      </div>
    );
  }

  return (
    <EditorErrorBoundary>
      <Editor
        height="100%"
        path={modelPath(projectPath, activeTab.filePath)}
        defaultValue={activeTab.content}
        defaultLanguage={SICXE_LANGUAGE_ID}
        keepCurrentModel
        onMount={handleEditorDidMount}
      />
    </EditorErrorBoundary>
  );
}
