// Monaco setup, run once when the editor is first imported.
// Monaco is the copy bundled with the app: left unconfigured, @monaco-editor/react
// downloads it from a CDN at runtime, and the editor never appears without internet.
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { registerSicxe } from '@/features/editor/monaco/sicxe';

self.MonacoEnvironment = {
  // Only the core editor worker is needed: SIC/XE has no language service of its own.
  getWorker: () => new EditorWorker(),
};

loader.config({ monaco });

// When an editor is disposed, Monaco cancels its pending work (word highlighting, for
// example) by rejecting promises nobody awaits, with an error named 'Canceled'. Like
// VS Code, treat these as expected rather than as unhandled rejections.
window.addEventListener('unhandledrejection', event => {
  const reason: unknown = event.reason;
  if (reason instanceof Error && reason.name === 'Canceled' && reason.message === 'Canceled') {
    event.preventDefault();
  }
});
registerSicxe(monaco);
