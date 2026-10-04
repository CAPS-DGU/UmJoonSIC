import * as monaco from 'monaco-editor';

export const sicxeLanguage: monaco.languages.IMonarchLanguage = {
  tokenizer: {
    root: [
      [/^\s*\..*/, 'comment'], // comment line (starts with '.')
      [
        /\b(LDA|STA|ADD|SUB|MUL|DIV|LDX|STX|COMP|JSUB|RSUB|J|JEQ|JLT|JGT|CLEAR|TIX|TD|RD|WD)\b/i,
        'keyword',
      ], // instructions
      [/\b(START|END|BYTE|WORD|RESB|RESW|BASE|NOBASE|EQU)\b/i, 'keyword.directive'], // assembler directives
      [/#[a-zA-Z0-9_]+/, 'number.immediate'], // immediate (#VALUE)
      [/@[a-zA-Z0-9_]+/, 'variable.indirect'], // indirect (@VALUE)
      [/[a-zA-Z_]\w*/, 'identifier'], // symbols (labels, names)
      [/[0-9]+/, 'number'], // decimal number
      [/X'([0-9A-Fa-f]+)'/, 'number.hex'], // hex constant
      [/C'([^']+)'/, 'string'], // character constant
      [/:/, 'delimiter'], // colon
      [/[,+\-*/]/, 'operator'], // operators
    ],
  },
};
