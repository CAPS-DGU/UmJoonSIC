import * as monaco from 'monaco-editor';

export const sicxeTheme: monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    // 주석 - 연한 초록색, 이탤릭
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'comment.line', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'comment.block', foreground: '6A9955', fontStyle: 'italic' },

    // 키워드 - 밝은 파란색, 볼드
    { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
    { token: 'keyword.control', foreground: 'C586C0', fontStyle: 'bold' },

    // 변수/라벨 - 밝은 청록색
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'variable.name', foreground: '9CDCFE' },
    { token: 'variable.parameter', foreground: '9CDCFE' },

    // 숫자 - 연한 노란색
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'number.hex', foreground: 'B5CEA8' },
    { token: 'number.binary', foreground: 'B5CEA8' },

    // 연산자 - 밝은 회색
    { token: 'operator', foreground: 'D4D4D4' },
    { token: 'operator.arithmetic', foreground: 'D4D4D4' },
    { token: 'operator.logical', foreground: 'D4D4D4' },

    // 구분자 - 밝은 회색
    { token: 'delimiter', foreground: 'D4D4D4' },
    { token: 'delimiter.square', foreground: 'D4D4D4' },
    { token: 'delimiter.parenthesis', foreground: 'D4D4D4' },
    { token: 'delimiter.curly', foreground: 'D4D4D4' },

    // 문자열 - 연한 주황색
    { token: 'string', foreground: 'CE9178' },
    { token: 'string.quoted', foreground: 'CE9178' },
    { token: 'string.quoted.single', foreground: 'CE9178' },
    { token: 'string.quoted.double', foreground: 'CE9178' },

    // 함수/명령어 - 밝은 보라색
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'function.name', foreground: 'DCDCAA' },

    // 상수 - 연한 분홍색
    { token: 'constant', foreground: '4FC1FF' },
    { token: 'constant.numeric', foreground: 'B5CEA8' },
    { token: 'constant.character', foreground: '4FC1FF' },

    // 타입 - 연한 초록색
    { token: 'type', foreground: '4EC9B0' },
    { token: 'type.primitive', foreground: '4EC9B0' },

    // 기타 토큰들
    { token: 'entity', foreground: '9CDCFE' },
    { token: 'entity.name', foreground: '9CDCFE' },
    { token: 'entity.name.function', foreground: 'DCDCAA' },
    { token: 'entity.name.type', foreground: '4EC9B0' },

    // 특수 문자들
    { token: 'punctuation', foreground: 'D4D4D4' },
    { token: 'punctuation.definition', foreground: 'D4D4D4' },
    { token: 'punctuation.separator', foreground: 'D4D4D4' },
    { token: 'punctuation.terminator', foreground: 'D4D4D4' },
  ],
  colors: {
    // 에디터 배경색
    'editor.background': '#1E1E1E',
    'editor.foreground': '#D4D4D4',

    // 선택 영역
    'editor.selectionBackground': '#264F78',
    'editor.selectionHighlightBackground': '#2A2D2E',

    // 현재 라인 하이라이트
    'editor.lineHighlightBackground': '#2A2D2E',
    'editor.lineHighlightBorder': '#454545',

    // 커서
    'editorCursor.foreground': '#AEAFAD',

    // 인디케이터
    'editorIndentGuide.background': '#404040',
    'editorIndentGuide.activeBackground': '#707070',

    // 스크롤바
    'scrollbarSlider.background': '#424242',
    'scrollbarSlider.hoverBackground': '#4F4F4F',
    'scrollbarSlider.activeBackground': '#686868',

    // 라인 번호
    'editorLineNumber.foreground': '#858585',
    'editorLineNumber.activeForeground': '#C6C6C6',

    // 검색 하이라이트
    'editor.findMatchBackground': '#515C6A',
    'editor.findMatchHighlightBackground': '#3A3D41',

    // 브레이크포인트
    'editor.breakpointBackground': '#E51400',
    'editor.breakpointBorder': '#E51400',

    // 에러/경고
    'editorError.foreground': '#F44747',
    'editorWarning.foreground': '#CCA700',
    'editorInfo.foreground': '#75BEFF',
  },
};
