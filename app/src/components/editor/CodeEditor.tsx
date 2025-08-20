import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import * as monaco_editor from 'monaco-editor';
import { useEditorTabStore } from '@/stores/EditorTabStore';
import { useProjectStore } from '@/stores/ProjectStore';

function registerAssemblyLanguage(monaco: typeof monaco_editor | null) {
  if (monaco) {
    monaco.languages.register({ id: 'asm' });

    monaco.languages.setMonarchTokensProvider('asm', {
      tokenizer: {
        root: [
          [/^\s*;.*/, 'comment'], // 세미콜론 시작 주석
          [/\b(mov|add|sub|jmp|cmp|je|jne|call|ret)\b/, 'keyword'], // 어셈블리 기본 명령어
          [/\b(ax|bx|cx|dx|si|di|sp|bp)\b/, 'variable'], // 레지스터
          [/[a-zA-Z_]\w*/, 'identifier'], // 심볼
          [/\d+/, 'number'], // 숫자
          [/:/, 'delimiter'], // 콜론
          [/[,+\-*/]/, 'operator'], // 연산자
          [/\[|\]/, 'delimiter.square'], // 대괄호
        ],
      },
    });

    monaco.editor.defineTheme('asmTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'operator', foreground: 'D4D4D4' },
        { token: 'delimiter', foreground: 'D4D4D4' },
        { token: 'delimiter.square', foreground: 'D4D4D4' },
      ],
      colors: {},
    });
  }
}

// 에디터 컴포넌트
export default function CodeEditor() {
  const monaco = useMonaco();
  const { tabs, getActiveTab, setFileContent, setCursor } = useEditorTabStore();
  const { projectPath } = useProjectStore();
  const activeTab = getActiveTab();
  const editorRef = useRef<monaco_editor.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = (editor: monaco_editor.editor.IStandaloneCodeEditor, monaco: typeof monaco_editor | null) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((e) => {
      const currentActiveTab = getActiveTab();
      if (currentActiveTab) {
        setCursor(currentActiveTab.idx, { line: e.position.lineNumber, column: e.position.column });
      }
    });

    editor.onDidChangeModelContent(() => {
      const currentActiveTab = getActiveTab();
      if (currentActiveTab) {
        setFileContent(currentActiveTab.idx, editor.getValue());
      }
    });
  }

  useEffect(() => {
    if (activeTab && activeTab.filePath && projectPath) {
      console.log("Loading file:", projectPath + "/" + activeTab.filePath);
      console.log(tabs);
      window.api.readFile(projectPath + "/" + activeTab.filePath).then((res: { success: boolean; data?: string; message?: string }) => {
        if (res.success && res.data) {
          console.log("File loaded:", res.data);
          setFileContent(activeTab.idx, res.data);
        } else {
          console.error("Failed to load file:", res.message);
        }
      }).catch(console.error);
    }
  }, [activeTab?.idx, activeTab?.filePath, projectPath]);

  useEffect(() => {
    registerAssemblyLanguage(monaco);
  }, [monaco]);

  if(tabs.length === 0) {
    return <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-2xl font-bold">열려있는 파일이 없습니다. </h1>
      <p className="text-sm text-gray-500">파일을 열어 새로운 탭을 만드세요</p>
    </div>;
  }

  return (
    <>
      <Editor
        height="400px"
        theme="asmTheme" // 추가한 테마를 적용합니다.
        defaultLanguage="asm" // 기본 언어를 'asm'으로 설정합니다.
        value={activeTab?.fileContent}
        onMount={handleEditorDidMount}

        // value={activeTab?.fileContent}
        // onChange={(value) => {
        //   console.log(value);
        //   if (activeTab && typeof value === 'string') {
        //     setFileContent(activeTab.idx, value);
        //   }
        // }}
      />
    </>
  );
}