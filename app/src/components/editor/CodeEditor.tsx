import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect } from 'react';
import * as monaco_editor from 'monaco-editor';

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

  useEffect(() => {
    registerAssemblyLanguage(monaco);
  }, [monaco]);

  return (
    <Editor
      height="400px"
      theme="asmTheme" // 추가한 테마를 적용합니다.
      defaultLanguage="asm" // 기본 언어를 'asm'으로 설정합니다.
      defaultValue={`
; This is a simple assembly example
mov ax, 5
add bx, ax
jmp end_program

start_loop:
  mov cx, 10
  cmp cx, 0
  je start_loop

end_program:
  ; Program ends
`}
    />
  );
}