// Use the Monaco that is bundled with the app. Left unconfigured, @monaco-editor/react
// downloads Monaco from a CDN at runtime, and the editor never appears without internet.
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  // Only the core editor worker is needed: SIC/XE has no language service of its own.
  getWorker: () => new EditorWorker(),
};

loader.config({ monaco });
