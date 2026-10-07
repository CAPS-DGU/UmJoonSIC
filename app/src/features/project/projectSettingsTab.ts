import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { strings } from '@/i18n';

/** The tab of the project settings (it edits project.sic); identified by this path. */
export const SETTINGS_TAB = 'project.sic';

/** Open (or show) the project settings. */
export const openProjectSettings = () =>
  useEditorTabStore.getState().openTab({ title: strings().settings.title, filePath: SETTINGS_TAB });
