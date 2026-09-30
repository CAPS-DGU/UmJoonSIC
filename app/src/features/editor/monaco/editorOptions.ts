import * as monaco_editor from 'monaco-editor';

/**
 * Monaco 에디터에 적용할 기본 옵션 객체입니다.
 */
export const editorOptions: monaco_editor.editor.IStandaloneEditorConstructionOptions = {
  glyphMargin: true,
  lineNumbers: 'on',
  folding: true,
  minimap: { enabled: true },
  scrollBeyondLastLine: true,
  renderLineHighlight: 'all',
  selectOnLineNumbers: true,

  // 🔹 고정폭 + 자간 + 컬럼 맞춤 (SIC/XE용)
  fontFamily: 'JetBrains Mono', // 고정폭 폰트
  fontSize: 12, // 폰트 크기
  letterSpacing: 0,
  tabSize: 8, // SIC/XE 컬럼 기준 탭
  insertSpaces: true, // 탭 대신 스페이스
  rulers: [9, 17, 35], // 컬럼 가이드
  wordWrap: 'off', // 자동 줄바꿈 해제
};
