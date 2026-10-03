import type * as monaco_editor from 'monaco-editor';
import { sicxeLanguage } from '@/features/editor/monaco/sicxeLanguage';
import { sicxeTheme } from '@/features/editor/monaco/sicxeTheme';

export const SICXE_LANGUAGE_ID = 'sicxe';

/** Register the SIC/XE language (tokenizer) and its colour theme with Monaco. */
export function registerSicxe(monaco: typeof monaco_editor) {
  monaco.languages.register({ id: SICXE_LANGUAGE_ID });
  monaco.languages.setMonarchTokensProvider(SICXE_LANGUAGE_ID, sicxeLanguage);
  monaco.editor.defineTheme('sicxeTheme', sicxeTheme);
}
