import { useEffect, useRef, useCallback } from 'react';
import * as monaco_editor from 'monaco-editor';
import { useEditorTabStore, type EditorTab } from '@/stores/EditorTabStore';
import { clampLine } from '@/lib/editor-utils';

export function useBreakpointManager(
  editorRef: React.MutableRefObject<monaco_editor.editor.IStandaloneCodeEditor | null>,
  activeTab: EditorTab | undefined,
) {
  const { getActiveTab, toggleBreakpoint } = useEditorTabStore();
  const decorationIdsRef = useRef<string[]>([]);

  // Breakpoint 데코레이션 업데이트 함수 (기존 코드와 동일)
  const updateBreakpointDecorations = useCallback(
    (tab?: EditorTab) => {
      const targetTab = tab || activeTab;
      const editor = editorRef.current;
      if (!editor || !targetTab) {
        console.log('Cannot update decorations - editor or targetTab not available');
        return;
      }

      const model = editor.getModel();
      if (!model) return;

      console.log('Updating breakpoint decorations for breakpoints:', targetTab.breakpoints);

      if (decorationIdsRef.current.length > 0) {
        editor.deltaDecorations(decorationIdsRef.current, []);
      }

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
    },
    [activeTab, editorRef],
  );

  // Breakpoint 시각적 표시를 위한 CSS 추가 (기존 코드와 동일)
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
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

  // Active tab이 변경될 때 breakpoint 데코레이션 업데이트
  useEffect(() => {
    if (editorRef.current && activeTab) {
      updateBreakpointDecorations(activeTab);
    }
  }, [activeTab, editorRef, updateBreakpointDecorations]); // activeTab.idx, filePath 대신 객체 자체를 의존성으로 사용

  // Breakpoint 클릭 이벤트 처리 로직을 담은 핸들러
  const handleBreakpointMouseDown = useCallback(
    (e: monaco_editor.editor.IEditorMouseEvent) => {
      let lineNumber: number | undefined;

      if (e.target.type === monaco_editor.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        lineNumber = e.target.position?.lineNumber;
      } else if (e.target.type === monaco_editor.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
        lineNumber = e.target.position?.lineNumber;
      }

      if (lineNumber && activeTab) {
        toggleBreakpoint(activeTab.idx, lineNumber);

        setTimeout(() => {
          const updatedActiveTab = getActiveTab();
          if (updatedActiveTab) {
            updateBreakpointDecorations(updatedActiveTab);
          }
        }, 0);
      }
    },
    [activeTab, getActiveTab, toggleBreakpoint, updateBreakpointDecorations],
  );

  // 생성한 마우스 다운 핸들러를 반환
  return { handleBreakpointMouseDown };
}
