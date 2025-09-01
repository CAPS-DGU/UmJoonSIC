import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useRef, useMemo } from 'react';
import * as monaco_editor from 'monaco-editor';
import { useEditorTabStore, type EditorTab } from '@/stores/EditorTabStore';
import { useProjectStore } from '@/stores/ProjectStore';
import { useSyntaxCheck } from '@/hooks/useSyntaxCheck';
import { sicxeLanguage } from '@/constants/monaco/sicxeLanguage';
import { sicxeTheme } from '@/constants/monaco/sicxeTheme';

import EditorErrorBoundary from './EditorErrorBoundary';
import '@/styles/SyntaxError.css';

const clampLine = (line1: number, model: monaco_editor.editor.ITextModel) => {
  return Math.max(1, Math.min(line1 ?? 1, model.getLineCount()));
};

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
  const { tabs, getActiveTab, setFileContent, setCursor, setIsModified, toggleBreakpoint } =
    useEditorTabStore();
  const { projectPath } = useProjectStore();
  const activeTab = getActiveTab();
  const editorRef = useRef<monaco_editor.editor.IStandaloneCodeEditor | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const isLoadingRef = useRef(false);
  const texts = useMemo(() => (activeTab ? [activeTab.fileContent] : []), [activeTab]);
  const fileNames = useMemo(() => (activeTab ? [activeTab.filePath] : []), [activeTab]);

  const { result, runCheck } = useSyntaxCheck();

  useEffect(() => {
    if (!activeTab) return;

    // 탭 전환 시 문법 검사
    runCheck([activeTab.fileContent], [activeTab.filePath]);
  }, [activeTab, runCheck]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        runCheck(texts, fileNames); // 저장 시 검사
      }

      if (['Tab', 'Enter', ' '].includes(e.key)) {
        runCheck(texts, fileNames); // 공백류 입력 시 검사
      }
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

    // Breakpoint 기능 활성화
    editor.updateOptions({
      glyphMargin: true, // Breakpoint를 위한 여백 활성화
      lineNumbers: 'on',
      folding: true,
      minimap: { enabled: true }, // 미니맵 비활성화로 공간 확보
      scrollBeyondLastLine: false,
    });

    // 폰트가 로드된 후 재랜더링해 보조선과 글자 간격 맞추기
    document.fonts.ready.then(() => {
      editor.updateOptions({
        fontFamily: 'JetBrains Mono',
        letterSpacing: 0.1,
      });
      editor.layout();
    });

    // Breakpoint 클릭 이벤트 처리
    editor.onMouseDown(e => {
      console.log('Mouse down event:', e.target.type, e.target.position);
      console.log('Mouse target details:', e.target);

      // 클릭된 위치에서 라인 번호 추출
      let lineNumber: number | undefined;

      if (e.target.type === monaco_editor.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        lineNumber = e.target.position?.lineNumber;
        console.log('Glyph margin clicked at line:', lineNumber);
      } else if (e.target.type === monaco_editor.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
        lineNumber = e.target.position?.lineNumber;
        console.log('Line number clicked at line:', lineNumber);
      }
      // CONTENT_TEXT 클릭은 제거 - 코드 본문 클릭 시 중단점 토글 방지

      if (lineNumber && activeTab) {
        console.log('Before toggle - activeTab breakpoints:', activeTab.breakpoints);
        console.log('Toggling breakpoint for line:', lineNumber);

        toggleBreakpoint(activeTab.idx, lineNumber);

        // 상태 업데이트 후 다시 확인
        setTimeout(() => {
          const updatedActiveTab = getActiveTab();
          console.log(
            'After toggle - updatedActiveTab breakpoints:',
            updatedActiveTab?.breakpoints,
          );
          if (updatedActiveTab) {
            updateBreakpointDecorations(updatedActiveTab);
          }
        }, 0);

        console.log('Breakpoint toggled for line:', lineNumber);
      } else {
        console.log('No valid line number or active tab. Target type:', e.target.type);
      }
    });

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
  };

  // Breakpoint 데코레이션 업데이트 함수
  const updateBreakpointDecorations = (tab?: EditorTab) => {
    const targetTab = tab || activeTab;
    const editor = editorRef.current;
    if (!editor || !targetTab) {
      console.log('Cannot update decorations - editor or targetTab not available');
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    console.log('Updating breakpoint decorations for breakpoints:', targetTab.breakpoints);

    // 기존 데코 제거
    if (decorationIdsRef.current.length > 0) {
      editor.deltaDecorations(decorationIdsRef.current, []);
    }

    // ✅ 숫자 보정 + 1~lineCount 범위로 제한 + 중복 제거
    const validLines = (targetTab.breakpoints ?? [])
      .map((n: unknown) => Math.floor(Number(n)))
      .filter((n: number) => Number.isFinite(n))
      .map((n: number) => clampLine(n, model))
      .filter((n: number, i: number, arr: number[]) => arr.indexOf(n) === i);

    const decorations = validLines.map((lineNumber: number) => ({
      range: new monaco_editor.Range(lineNumber, 1, lineNumber, 1),
      options: {
        glyphMarginClassName: 'breakpoint-glyph',
        glyphMarginHoverMessage: { value: 'Breakpoint' },
        isWholeLine: false,
        stickiness: monaco_editor.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    }));

    console.log('Created decorations:', decorations);
    decorationIdsRef.current = editor.deltaDecorations([], decorations);
    console.log('Applied decoration IDs:', decorationIdsRef.current);
  };

  // Breakpoint 시각적 표시를 위한 CSS 추가
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Breakpoint 아이콘 스타일 - Monaco Editor의 기본 위치 사용 */
      .breakpoint-glyph {
        background-color: #e51400 !important;
        border-radius: 50% !important;
        border: 2px solid #ffffff !important;
        width: 12px !important;
        height: 12px !important;
        display: inline-block !important;
        margin: 2px !important;
      }
      
      .breakpoint-glyph:hover {
        background-color: #ff0000 !important;
        transform: scale(1.1) !important;
      }
    `;
    document.head.appendChild(style);

    console.log('Breakpoint CSS styles applied');

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

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

  // Active tab이 변경될 때 breakpoint 데코레이션 업데이트
  useEffect(() => {
    if (editorRef.current && activeTab) {
      updateBreakpointDecorations(activeTab);
    }
  }, [activeTab?.idx, activeTab?.filePath]);

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
        height="100%"
        theme="asmTheme" // 추가한 테마를 적용합니다.
        defaultLanguage="sicxe" // 기본 언어를 'asm'으로 설정합니다.
        value={activeTab?.fileContent}
        onMount={handleEditorDidMount}
        options={{
          glyphMargin: true,
          lineNumbers: 'on',
          folding: true,
          minimap: { enabled: true },
          scrollBeyondLastLine: true,
          renderLineHighlight: 'all',
          selectOnLineNumbers: true,

          // 🔹 고정폭 + 자간 + 컬럼 맞춤
          fontFamily: 'JetBrains Mono', // 고정폭 폰트
          fontSize: 16, // 폰트 크기
          tabSize: 8, // SIC/XE 컬럼 기준 탭
          insertSpaces: true, // 탭 대신 스페이스
          rulers: [8, 16, 24], // 컬럼 가이드
          wordWrap: 'off', // 자동 줄바꿈 해제
          fontLigatures: false,
        }}
      />
    </EditorErrorBoundary>
  );
}
