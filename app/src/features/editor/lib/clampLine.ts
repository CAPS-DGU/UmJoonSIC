import * as monaco_editor from 'monaco-editor';

/**
 * 주어진 줄 번호가 모델의 전체 줄 수 범위 내에 있도록 보정합니다.
 */
export const clampLine = (line: number, model: monaco_editor.editor.ITextModel) => {
  return Math.max(1, Math.min(line ?? 1, model.getLineCount()));
};
