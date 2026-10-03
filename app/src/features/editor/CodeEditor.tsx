import { useEffect, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import type * as monaco_editor from 'monaco-editor';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import EditorErrorBoundary from '@/features/editor/EditorErrorBoundary';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { useAutoIndentation } from '@/features/editor/hooks/useAutoIndentation';
import { useDebounceFn } from '@/features/editor/hooks/useDebounceFn';
import { useEditorShortcuts } from '@/features/editor/hooks/useEditorShortcuts';
import { useErrorMarkers } from '@/features/editor/hooks/useErrorMarkers';
import { useFileContent } from '@/features/editor/hooks/useFileContent';
import { checkSyntax, isProjectAsmFile } from '@/features/editor/lib/syntaxCheck';
import { editorOptions } from '@/features/editor/monaco/editorOptions';
import '@/features/editor/monaco/monacoLoader';
import { registerSicxe, SICXE_LANGUAGE_ID } from '@/features/editor/monaco/sicxe';
import { useProjectStore } from '@/features/project/projectStore';
import '@/features/editor/syntaxError.css';

type MonacoEditor = monaco_editor.editor.IStandaloneCodeEditor;

/** Typing pauses this long before the syntax is checked. */
const SYNTAX_CHECK_DEBOUNCE_MS = 1000;

/** The Monaco editor for the active tab. A new editor instance is created per tab. */
export default function CodeEditor() {
  const monaco = useMonaco();
  const tabs = useEditorTabStore(state => state.tabs);
  const getActiveTab = useEditorTabStore(state => state.getActiveTab);
  const setFileContent = useEditorTabStore(state => state.setFileContent);
  const setCursor = useEditorTabStore(state => state.setCursor);
  const setIsModified = useEditorTabStore(state => state.setIsModified);
  const mode = useMemoryViewStore(state => state.mode);
  const { projectPath } = useProjectStore();
  const activeTab = getActiveTab();

  const editorRef = useRef<MonacoEditor | null>(null);
  const hasCheckedOnOpenRef = useRef(false);

  const { handleKeyDown: alignOnKeyDown, handlePaste: alignPastedLines } = useAutoIndentation(
    editorRef,
    monaco,
  );
  const debouncedCheckSyntax = useDebounceFn(checkSyntax, SYNTAX_CHECK_DEBOUNCE_MS);

  // Check the first file once, as soon as its content has been read.
  useEffect(() => {
    if (!activeTab || hasCheckedOnOpenRef.current) return;
    if (!activeTab.fileContent) return;
    if (!isProjectAsmFile(activeTab.filePath)) return;

    checkSyntax([activeTab.fileContent], [activeTab.filePath]);
    hasCheckedOnOpenRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.idx]);

  // When the tab changes, restore its cursor and bring that line into view.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTab) return;

    const { line, column } = activeTab.cursor ?? { line: 1, column: 1 };
    editor.setPosition({ lineNumber: line, column: column });
    // after the layout has settled
    setTimeout(() => {
      editor.revealLineInCenter(line);
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.idx]);

  useErrorMarkers(editorRef, monaco, activeTab);
  useEditorShortcuts(editorRef, debouncedCheckSyntax);
  const isLoadingRef = useFileContent(activeTab, projectPath);

  useEffect(() => {
    if (monaco) registerSicxe(monaco);
  }, [monaco]);

  // What is valid depends on the machine mode, so re-check the open project files when it changes.
  useEffect(() => {
    const { tabs: currentTabs } = useEditorTabStore.getState();
    const projectTabs = currentTabs.filter(t => isProjectAsmFile(t.filePath));
    if (!projectTabs.length) return;
    checkSyntax(
      projectTabs.map(t => t.fileContent ?? ''),
      projectTabs.map(t => t.filePath),
    );
  }, [mode]);

  const handleEditorDidMount = (editor: MonacoEditor) => {
    editorRef.current = editor;

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
      const currentTab = getActiveTab();
      if (currentTab) {
        setCursor(currentTab.idx, { line: e.position.lineNumber, column: e.position.column });
      }
    });

    // Pasted text is checked at once, without the debounce.
    // NOTE: reports under the path of the tab that was active when this editor was mounted.
    editor.onDidPaste(() => {
      const currentTab = getActiveTab();
      if (!currentTab || !isProjectAsmFile(currentTab.filePath)) return;
      checkSyntax([editor.getValue()], [activeTab!.filePath]);
    });

    editor.onDidChangeModelContent(() => {
      const currentTab = getActiveTab();
      // Content that arrives from disk is not a modification.
      if (!currentTab || isLoadingRef.current) return;

      const value = editor.getValue();
      setIsModified(currentTab.idx, true);
      setFileContent(currentTab.idx, value);
      if (isProjectAsmFile(currentTab.filePath)) {
        debouncedCheckSyntax([value], [currentTab.filePath]);
      }
    });

    // Column alignment applies to the project's .asm files only.
    editor.onKeyDown(e => {
      if (!editor.getModel()) return;
      if (isProjectAsmFile(getActiveTab()?.filePath)) {
        alignOnKeyDown(e);
      }
    });
    editor.onDidPaste(e => {
      if (!editor.getModel()) return;
      if (isProjectAsmFile(getActiveTab()?.filePath)) {
        alignPastedLines(e);
      }
    });
  };

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-bold">열려있는 파일이 없습니다. </h1>
        <p className="text-sm text-gray-500">파일을 열어 새로운 탭을 만드세요</p>
      </div>
    );
  }

  return (
    <EditorErrorBoundary>
      {/* NOTE: 'asmTheme' is not a registered theme name (registerSicxe defines 'sicxeTheme'),
          so Monaco falls back to its default theme. Kept as is to preserve the current look. */}
      <Editor
        key={activeTab?.idx}
        height="100%"
        theme="asmTheme"
        defaultLanguage={SICXE_LANGUAGE_ID}
        value={activeTab?.fileContent}
        onMount={handleEditorDidMount}
      />
    </EditorErrorBoundary>
  );
}
