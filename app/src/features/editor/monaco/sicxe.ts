import type * as monaco_editor from 'monaco-editor';
import { sicxeLanguage } from '@/features/editor/monaco/sicxeLanguage';

export const SICXE_LANGUAGE_ID = 'sicxe';

/** Register the SIC/XE language (its tokenizer) with Monaco. */
export function registerSicxe(monaco: typeof monaco_editor) {
  monaco.languages.register({ id: SICXE_LANGUAGE_ID });
  monaco.languages.setMonarchTokensProvider(SICXE_LANGUAGE_ID, sicxeLanguage);
}
