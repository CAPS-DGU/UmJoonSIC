import * as monaco from 'monaco-editor';

export const sicxeLanguage: monaco.languages.IMonarchLanguage = {
  tokenizer: {
    root: [
      [/^\s*\..*/, 'comment'], // 주석(.으로 시작)
      [
        /\b(LDA|STA|ADD|SUB|MUL|DIV|LDX|STX|COMP|JSUB|RSUB|J|JEQ|JLT|JGT|CLEAR|TIX|TD|RD|WD)\b/i,
        'keyword',
      ], // 명령어
      [/\b(START|END|BYTE|WORD|RESB|RESW|BASE|NOBASE|EQU)\b/i, 'keyword.directive'], // 지시어
      [/#[a-zA-Z0-9_]+/, 'number.immediate'], // 즉시 주소 (#VALUE)
      [/@[a-zA-Z0-9_]+/, 'variable.indirect'], // 간접 주소 (@VALUE)
      [/[a-zA-Z_]\w*/, 'identifier'], // 심볼(Label, 이름)
      [/[0-9]+/, 'number'], // 10진수
      [/X'([0-9A-Fa-f]+)'/, 'number.hex'], // 16진 상수
      [/C'([^']+)'/, 'string'], // 문자 상수
      [/:/, 'delimiter'], // 콜론
      [/[,+\-*/]/, 'operator'], // 연산자
    ],
  },
};
