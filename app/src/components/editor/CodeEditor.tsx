import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import * as monaco_editor from 'monaco-editor';

import { useEditorTabStore } from '@/stores/EditorTabStore';
import { useProjectStore } from '@/stores/ProjectStore';
import { useErrorStore } from '@/stores/pannel/ErrorStore';
import { useSyntaxCheck } from '@/hooks/editor/useSyntaxCheck';
import { useAutoIndentation } from '@/hooks/editor/useAutoIndentation';
import { useDebounceFn } from '@/hooks/editor/useDebounceFn';
import { useMemoryViewStore } from '@/stores/MemoryViewStore';

import { editorOptions } from '@/constants/monaco/editor-config';
import { sicxeLanguage } from '@/constants/monaco/sicxeLanguage';
import { sicxeTheme } from '@/constants/monaco/sicxeTheme';

import { clampLine } from '@/lib/editor-utils';
// import { useBreakpointManager } from '@/hooks/editor/useBreakpointManager';

import EditorErrorBoundary from './EditorErrorBoundary';
import '@/styles/SyntaxError.css';

function registerAssemblyLanguage(monaco: typeof monaco_editor | null) {
  if (monaco) {
    monaco.languages.register({ id: 'sicxe' });
    monaco.languages.setMonarchTokensProvider('sicxe', sicxeLanguage);
    monaco.editor.defineTheme('sicxeTheme', sicxeTheme);
  }
}

// 에디터 컴포넌트
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

  const isProjectFile = (fp?: string) => {
    if (!fp) return false;
    const { settings } = useProjectStore.getState();
    return Array.isArray(settings?.asm) && settings.asm.includes(fp);
  };

  const editorRef = useRef<monaco_editor.editor.IStandaloneCodeEditor | null>(null);
  const isLoadingRef = useRef(false);
  const loadErrorDecorationIdsRef = useRef<string[]>([]);

  // const { handleBreakpointMouseDown } = useBreakpointManager(editorRef, activeTab);
  const {
    handleKeyDown: handleAutoIndentationKeyDown,
    handlePaste: handleAutoIndentationPaste,
    formatDocument,
  } = useAutoIndentation(editorRef, monaco);

  const { runCheck } = useSyntaxCheck();
  // Debounce된 runCheck 함수, 지금은 1000ms로 설정
  const debouncedRunCheck = useDebounceFn(runCheck, 1000);
  const errors = useErrorStore(state => state.errors);
  const hasRunRef = useRef(false);

  // 최초 마운트 구문 검사를 위한 useEffect
  useEffect(() => {
    if (!activeTab || hasRunRef.current) return;
    if (!activeTab.fileContent) return; // 파일 내용이 준비되지 않았으면 대기
    if (!isProjectFile(activeTab.filePath)) return; // 파일이 project에 소속된 asm파일이 아니면 검사하지 않음
    runCheck([activeTab.fileContent], [activeTab.filePath]);
    hasRunRef.current = true; // 한 번만 실행
  }, [activeTab?.idx, runCheck]);

  // 커서 위치 동기화
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTab) return;

    const { line, column } = activeTab.cursor ?? { line: 1, column: 1 };
    editor.setPosition({ lineNumber: line, column: column });

    // 레이아웃이 끝난 뒤 중앙으로 스크롤
    setTimeout(() => {
      editor.revealLineInCenter(line);
    }, 50);
  }, [activeTab?.idx]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTab || !errors) return;

    const model = editor.getModel();
    if (!model || !monaco) return;

    if (!errors[activeTab.filePath]?.length) {
      monaco.editor.setModelMarkers(model, 'sicxe', []);
      if (loadErrorDecorationIdsRef.current.length > 0) {
        loadErrorDecorationIdsRef.current = editor.deltaDecorations(
          loadErrorDecorationIdsRef.current,
          [],
        );
      }
      return;
    }

    const markers = errors[activeTab.filePath].map(err => {
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

    monaco.editor.setModelMarkers(model, 'sicxe', markers);

    const loadErrorLines = errors[activeTab.filePath]
      .filter(err => err.type === 'load')
      .map(err => clampLine(err.row, model));

    const newDecorations = loadErrorLines.map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: 'load-error-line',
      },
    }));

    // 기존 decorations 교체
    loadErrorDecorationIdsRef.current = editor.deltaDecorations(
      loadErrorDecorationIdsRef.current,
      newDecorations,
    );
  }, [errors, activeTab?.idx, monaco]);

  const handleEditorDidMount = (editor: monaco_editor.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    const setupEditorAfterFontLoad = async () => {
      try {
        // 1) Load editor font explicitly
        await document.fonts.load(`12px "JetBrains Mono"`);
        console.log('JetBrains Mono font loaded.');

        // 2) Apply options AFTER font is ready
        editor.updateOptions({
          ...editorOptions,
          // ⬇ Disable Monaco's own indent/format so our hook controls it
          autoIndent: 'none',
          formatOnType: false,
          formatOnPaste: false,
          tabCompletion: 'off',
        });
        console.log('Editor options applied after font load (autoIndent off).');

        // 3) Recalculate layout a tick later
        setTimeout(() => {
          console.log('Recalculating editor layout to ensure alignment.');
          editor.layout();
        }, 50);
      } catch (error) {
        console.error('Font loading failed:', error);
        // Apply options even if font load fails
        editor.updateOptions({
          ...editorOptions,
          autoIndent: 'none',
          formatOnType: false,
          formatOnPaste: false,
          tabCompletion: 'off',
        });
      }
    };

    setupEditorAfterFontLoad();

    // --- Wiring (unchanged) ---
    // editor.onMouseDown(handleBreakpointMouseDown);

    editor.onDidChangeCursorPosition(e => {
      const currentActiveTab = getActiveTab();
      if (currentActiveTab) {
        setCursor(currentActiveTab.idx, {
          line: e.position.lineNumber,
          column: e.position.column,
        });
      }
    });

    // Run syntax check on paste (full doc)
    editorRef.current.onDidPaste(() => {
      // 파일이 asm목록에 소속되었을 경우에만 검사
      const t = getActiveTab();
      if (!t || !isProjectFile(t.filePath)) return;
      runCheck([editorRef.current!.getValue()], [activeTab!.filePath]);
    });

    editor.onDidChangeModelContent(() => {
      const currentActiveTab = getActiveTab();
      if (currentActiveTab && !isLoadingRef.current) {
        setIsModified(currentActiveTab.idx, true);
        const value = editor.getValue();
        setFileContent(currentActiveTab.idx, value);
        // 파일이 asm목록에 소속되었을 경우에만 검사
        if (isProjectFile(currentActiveTab.filePath)) {
          debouncedRunCheck([value], [currentActiveTab.filePath]);
        }
      }
    });


    // Delegate keys to our auto-indenter (it will prevent default for Tab/Enter)
    editor.onKeyDown(e => {
      const model = editor.getModel();
      if (!model) return;
      const t = getActiveTab();
      if (t && isProjectFile(t.filePath)) {
        handleAutoIndentationKeyDown(e);
      }
    });

    editor.onDidPaste(e => {
      const model = editor.getModel();
      if (!model) return;
      const t = getActiveTab();
      if (t && isProjectFile(t.filePath)) {
        handleAutoIndentationPaste(e);
      }
    });
  };

  // ✨ [수정] 여러 군데 흩어져 있던 KeyDown 관련 useEffect를 하나로 통합하고,
  // 저장 로직을 수정하여 포맷팅된 최신 내용을 저장하도록 합니다.
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const editor = editorRef.current;
      const key = event.key;
      const activeTab = getActiveTab();

      // 줌 단축키는 Electron이 처리하도록 그대로 둡니다
      if ((event.ctrlKey || event.metaKey) && (key === '+' || key === '-' || key === '=' || key === '0')) {
        return; // Electron의 기본 줌 기능이 처리하도록 함
      }

      // 저장 (Ctrl+S or Cmd+S)
      if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 's') {
        event.preventDefault();
        event.stopPropagation();
        if (activeTab && editor) {
          // 1. 먼저 전체 문서를 포맷합니다.
          // only format project files
          if (isProjectFile(activeTab.filePath)) {
            formatDocument();
          }

          // 2. 포맷팅이 적용될 시간을 짧게 기다린 후, 구문 분석과 저장을 실행합니다.
          setTimeout(() => {
            const formattedContent = editor.getValue();
            // 구문 분석 실행
            // only syntax-check project files
            if (isProjectFile(activeTab.filePath)) {
              runCheck([formattedContent], [activeTab.filePath]);
            }

            // 파일 저장 API 호출
            window.api
              .saveFile(projectPath + '/' + activeTab.filePath, formattedContent)
              .then((res: { success: boolean; message?: string }) => {
                if (res.success) {
                  setIsModified(activeTab.idx, false);
                  console.log('File saved successfully');
                } else {
                  console.error('Failed to save file:', res.message);
                }
              });
          }, 100);
        }
        return;
      }

      // 구문 분석 (모든 키) - 에디터가 포커스되어 있을 때만
      if (editor && editor.hasTextFocus()) {
        const t = getActiveTab();
        if (t && isProjectFile(t.filePath)) {
          debouncedRunCheck([editor.getValue()], [t.filePath]);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [getActiveTab, projectPath, setIsModified, formatDocument, runCheck, debouncedRunCheck]);

  useEffect(() => {
    if (activeTab && activeTab.filePath && projectPath) {
      console.log('Loading file:', projectPath + '/' + activeTab.filePath);
      console.log(tabs);

      isLoadingRef.current = true;
      window.api
        .readFile(projectPath + '/' + activeTab.filePath)
        .then((res: { success: boolean; data?: string; message?: string }) => {
          if (res.success && res.data) {
            console.log('File loaded:', res.data);
            setFileContent(activeTab.idx, res.data);
            setIsModified(activeTab.idx, false); // 파일 로드 후 수정 상태 초기화
          } else {
            console.error('Failed to load file:', res.message);
          }
        })
        .catch(console.error)
        .finally(() => {
          isLoadingRef.current = false;
        });
    }
  }, [activeTab?.idx, activeTab?.filePath, projectPath]);

  useEffect(() => {
    registerAssemblyLanguage(monaco);
  }, [monaco]);

  // Mode-change re-check (project files only)
  useEffect(() => {
    const { tabs: currentTabs } = useEditorTabStore.getState();
    const { settings } = useProjectStore.getState();
    const asmSet = new Set(settings?.asm ?? []);

    const projTabs = currentTabs.filter(t => asmSet.has(t.filePath));
    if (!projTabs.length) return;

    runCheck(
      projTabs.map(t => t.fileContent ?? ''),
      projTabs.map(t => t.filePath),
    );
  }, [mode, runCheck]);

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
      <Editor
        key={activeTab?.idx}
        height="100%"
        theme="asmTheme" // 추가한 테마를 적용합니다.
        defaultLanguage="sicxe" // 기본 언어를 'asm'으로 설정합니다.
        value={activeTab?.fileContent}
        onMount={handleEditorDidMount}
        // options={editorOptions}
      />
    </EditorErrorBoundary>
  );
}
