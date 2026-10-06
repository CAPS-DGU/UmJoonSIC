import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import EditorErrorBoundary from '@/features/editor/EditorErrorBoundary';
import {
  selectActiveTab,
  tabPathOfModel,
  useEditorTabStore,
  type RevealRequest,
} from '@/features/editor/editorTabStore';
import { useEditorShortcuts } from '@/features/editor/hooks/useEditorShortcuts';
import { useErrorMarkers } from '@/features/editor/hooks/useErrorMarkers';
import { attachAutoIndentation } from '@/features/editor/lib/autoIndentation';
import {
  checkSyntax,
  isProjectAsmFile,
  scheduleSyntaxCheck,
} from '@/features/editor/lib/syntaxCheck';
import { editorOptions } from '@/features/editor/monaco/editorOptions';
import { modelPath } from '@/features/editor/monaco/models';
import { SICXE_LANGUAGE_ID } from '@/features/editor/monaco/sicxe';
import '@/features/editor/monaco/setupMonaco';
import { useErrorStore } from '@/features/panel/errorStore';
import { useStrings } from '@/i18n';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useProjectStore } from '@/features/project/projectStore';
import '@/features/editor/syntaxError.css';

type MonacoEditor = monaco.editor.IStandaloneCodeEditor;

/** The tab of the file an editor shows, found from its model (current at every event). */
const shownTabPath = (editor: MonacoEditor) => {
  const model = editor.getModel();
  return model ? tabPathOfModel(model.uri.toString()) : undefined;
};

/** Carry out a request to move the cursor, if the editor shows its file; then clear it. */
function applyRevealRequest(editor: MonacoEditor, request: RevealRequest | null) {
  if (!request || shownTabPath(editor) !== request.filePath) return;
  editor.setPosition({ lineNumber: request.line, column: request.column });
  editor.revealLineInCenter(request.line);
  useEditorTabStore.getState().clearRevealRequest(request.id);
}

/**
 * The Monaco editor for the active source tab. One editor instance shows one model per
 * file (see monaco/models.ts), so switching tabs keeps each file's text, undo history,
 * cursor and scroll position.
 */
/** The field guides (label, opcode, operand) of assembly files; other files get none. */
const rulersFor = (filePath: string | null) =>
  filePath?.toLowerCase().endsWith('.asm') ? editorOptions.rulers : [];
const optionsFor = () => ({
  ...editorOptions,
  rulers: rulersFor(useEditorTabStore.getState().activePath),
});

export default function CodeEditor() {
  const t = useStrings();
  const theme = usePreferencesStore(s => s.theme);
  const activeTab = useEditorTabStore(selectActiveTab);
  const revealRequest = useEditorTabStore(state => state.revealRequest);
  const projectPath = useProjectStore(state => state.projectPath);

  const editorRef = useRef<MonacoEditor | null>(null);
  const activePath = activeTab?.filePath ?? null;

  useErrorMarkers();
  useEditorShortcuts(editorRef);

  // A request to move the cursor (an error clicked, a failed load) is carried out once its
  // file is shown, and then cleared. The editor swaps the model in its own effect, which
  // runs before this one.
  useEffect(() => {
    if (editorRef.current) applyRevealRequest(editorRef.current, revealRequest);
  }, [revealRequest, activePath]);

  // The column guides are for assembly; a .txt file gets none.
  useEffect(() => {
    editorRef.current?.updateOptions({ rulers: rulersFor(activePath) });
  }, [activePath]);

  const handleEditorDidMount = (editor: MonacoEditor) => {
    editorRef.current = editor;
    editor.onDidDispose(() => {
      if (editorRef.current === editor) editorRef.current = null;
    });

    // The column layout depends on the fixed-width font, so apply the options once it is there.
    (async () => {
      try {
        await document.fonts.load(`12px "JetBrains Mono"`);
        editor.updateOptions(optionsFor());
        // measure again on the next tick, with the font in place
        setTimeout(() => editor.layout(), 50);
      } catch (error) {
        console.error('Font loading failed:', error);
        editor.updateOptions(optionsFor());
      }
    })();

    editor.onDidChangeCursorPosition(e => {
      const filePath = shownTabPath(editor);
      if (filePath) {
        useEditorTabStore
          .getState()
          .setCursor(filePath, { line: e.position.lineNumber, column: e.position.column });
      }
    });

    editor.onDidChangeModelContent(() => {
      const filePath = shownTabPath(editor);
      if (!filePath) return;
      const value = editor.getValue();
      useEditorTabStore.getState().setContent(filePath, value);
      // The lines of the last load's errors no longer match the text.
      useErrorStore.getState().clearErrors(filePath, 'load');
      if (isProjectAsmFile(filePath)) {
        scheduleSyntaxCheck(filePath, value);
      }
    });

    // Pasted text is checked at once, without waiting for typing to pause.
    editor.onDidPaste(() => {
      const filePath = shownTabPath(editor);
      if (filePath && isProjectAsmFile(filePath)) {
        checkSyntax([editor.getValue()], [filePath]);
      }
    });

    // Column alignment applies to the project's .asm files only.
    attachAutoIndentation(editor, () => isProjectAsmFile(shownTabPath(editor)));

    // A request made before the editor existed (the file was opened by an error click).
    applyRevealRequest(editor, useEditorTabStore.getState().revealRequest);
  };

  if (!activeTab) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
        <h1 className="text-lg font-semibold text-gray-800">{t.editor.noFile}</h1>
        <p className="text-sm text-gray-600">{t.editor.noFileHint}</p>
      </div>
    );
  }

  return (
    <EditorErrorBoundary>
      <Editor
        height="100%"
        path={modelPath(projectPath, activeTab.filePath)}
        defaultValue={activeTab.content}
        defaultLanguage={SICXE_LANGUAGE_ID}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        keepCurrentModel
        onMount={handleEditorDidMount}
      />
    </EditorErrorBoundary>
  );
}
