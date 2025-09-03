import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useRef, useMemo } from 'react';
import * as monaco_editor from 'monaco-editor';

import { useEditorTabStore } from '@/stores/EditorTabStore';
import { useProjectStore } from '@/stores/ProjectStore';
import { useSyntaxCheck } from '@/hooks/useSyntaxCheck';
import { useAutoIndentation } from '@/hooks/editor/useAutoIndentation';

import { editorOptions } from '@/constants/monaco/editor-config';
import { sicxeLanguage } from '@/constants/monaco/sicxeLanguage';
import { sicxeTheme } from '@/constants/monaco/sicxeTheme';

import { clampLine } from '@/lib/editor-utils';
import { useBreakpointManager } from '@/hooks/editor/useBreakpointManager';

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
  const { tabs, getActiveTab, setFileContent, setCursor, setIsModified } = useEditorTabStore();
  const { projectPath } = useProjectStore();
  const activeTab = getActiveTab();
  const editorRef = useRef<monaco_editor.editor.IStandaloneCodeEditor | null>(null);
  const isLoadingRef = useRef(false);
  const { handleBreakpointMouseDown } = useBreakpointManager(editorRef, activeTab);
  const { handleKeyDown: handleAutoIndentationKeyDown, handlePaste: handleAutoIndentationPaste } =
    useAutoIndentation(editorRef, monaco);
  const texts = useMemo(() => (activeTab ? [activeTab.fileContent] : []), [activeTab?.fileContent]);
  const fileNames = useMemo(() => (activeTab ? [activeTab.filePath] : []), [activeTab?.filePath]);

  const { result, runCheck } = useSyntaxCheck();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!activeTab || hasRunRef.current) return;
    if (!activeTab.fileContent) return; // 파일 내용이 준비되지 않았으면 대기

    runCheck([activeTab.fileContent], [activeTab.filePath]);
    hasRunRef.current = true; // 한 번만 실행
  }, [activeTab?.filePath, activeTab?.fileContent, runCheck]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      // 저장
      if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 's') {
        e.preventDefault();
        runCheck(texts, fileNames);
        return;
      }
      // 공백 관련 키만 검사
      if (key === ' ' || key === 'Tab' || key === 'Enter') {
        runCheck(texts, fileNames);
        return;
      }
      // 나머지 키는 무시
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [texts, fileNames, runCheck]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTab || !result) return;

    const model = editor.getModel();
    if (!model) return;

    const fileResult = result.files.find(
      f => f.fileName === activeTab.filePath || f.fileName === `<file-0>`,
    );

    if (!monaco || !fileResult) {
      return;
    }

    if (!fileResult || !fileResult.compileErrors?.length) {
      monaco.editor.setModelMarkers(model, 'sicxe', []);
      return;
    }

    const markers = fileResult.compileErrors.map(err => ({
      severity: monaco.MarkerSeverity.Error,
      message: err.message,
      startLineNumber: clampLine(err.row, model),
      startColumn: clampLine(err.col, model),
      endLineNumber: clampLine(err.row, model),
      endColumn: clampLine(err.col + (err.length ?? 1), model), // length 없으면 1로
    }));

    monaco.editor.setModelMarkers(model, 'sicxe', markers);
  }, [result, activeTab, monaco]);

  const handleEditorDidMount = (
    editor: monaco_editor.editor.IStandaloneCodeEditor,
    // monaco: typeof monaco_editor | null,
  ) => {
    editorRef.current = editor;
    const setupEditorAfterFontLoad = async () => {
      try {
        // 1. 'JetBrains Mono' 폰트를 명시적으로 로드하고 완료될 때까지 기다립니다.
        await document.fonts.load(`12px "JetBrains Mono"`);
        console.log('JetBrains Mono font loaded.');

        // 2. 폰트가 준비된 후, 에디터 옵션을 적용합니다.
        editor.updateOptions(editorOptions);
        console.log('Editor options applied after font load.');

        // 3. 렌더링 동기화를 위해 짧은 지연시간 후 레이아웃을 강제로 재계산합니다.
        setTimeout(() => {
          console.log('Recalculating editor layout to ensure alignment.');
          editor.layout();
        }, 50);
      } catch (error) {
        console.error('Font loading failed:', error);
        // 폰트 로딩에 실패하더라도 대체 폰트로 에디터가 동작하도록 옵션을 적용합니다.
        editor.updateOptions(editorOptions);
      }
    };
    setupEditorAfterFontLoad();

    editor.onMouseDown(handleBreakpointMouseDown);

    editor.onDidChangeCursorPosition(e => {
      const currentActiveTab = getActiveTab();
      if (currentActiveTab) {
        setCursor(currentActiveTab.idx, { line: e.position.lineNumber, column: e.position.column });
      }
    });

    // 복사시 문법 체크
    editorRef.current.onDidPaste(() => {
      runCheck([editorRef.current!.getValue()], [activeTab!.filePath]);
    });

    editor.onDidChangeModelContent(() => {
      const currentActiveTab = getActiveTab();
      if (currentActiveTab && !isLoadingRef.current) {
        setIsModified(currentActiveTab.idx, true);
        setFileContent(currentActiveTab.idx, editor.getValue());
      }
    });

    editor.onKeyDown(e => {
      const model = editor.getModel();
      if (!model) return;

      handleAutoIndentationKeyDown(e);
    });

    // 붙여넣기 -> 정상적으로 붙여넣기 후 붙여넣기된 모든 줄에 대하여 실행
    editor.onDidPaste(e => {
      const model = editor.getModel();
      if (!model) return;

      handleAutoIndentationPaste(e);
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        console.log('Ctrl+S pressed in React');
        const activeTab = getActiveTab();
        if (activeTab) {
          console.log('Save file in', projectPath + '/' + activeTab.filePath);
          window.api
            .saveFile(projectPath + '/' + activeTab.filePath, activeTab.fileContent)
            .then((res: { success: boolean; message?: string }) => {
              if (res.success) {
                setIsModified(activeTab.idx, false);
                console.log('File saved');
              } else {
                console.error('Failed to save file:', res.message);
              }
            });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
