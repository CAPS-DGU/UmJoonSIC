// The interface settings (language, theme). The main process keeps them (menus, dialogs and
// the start-up windows use them too); the page reads them before its first paint and follows
// every change, from its own controls or from the View menu.
import { create } from 'zustand';
import { AppEvent, type UiLanguage, type UiPreferences, type UiTheme } from '@shared/ipc';

const FALLBACK: UiPreferences = {
  language: 'ko',
  theme: 'light',
  editorFontSize: 12,
  simulatorPort: 9090,
};

function readInitial(): UiPreferences {
  try {
    return typeof window !== 'undefined' && window.api ? window.api.getUiPreferences() : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** The theme is the `dark` class on <html> (index.css); the language is its `lang`. */
function apply({ language, theme }: UiPreferences) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.lang = language;
}

interface PreferencesState extends UiPreferences {
  setLanguage: (language: UiLanguage) => void;
  setTheme: (theme: UiTheme) => void;
  setEditorFontSize: (size: number) => void;
  /** Applies at the next start (the simulator keeps its port while it runs). */
  setSimulatorPort: (port: number) => void;
}

const initial = readInitial();
apply(initial);

export const usePreferencesStore = create<PreferencesState>(() => ({
  ...initial,
  // The main process saves the change and announces it back (AppEvent.uiPreferences).
  setLanguage: language => window.api.setUiPreferences({ language }),
  setTheme: theme => window.api.setUiPreferences({ theme }),
  setEditorFontSize: editorFontSize => window.api.setUiPreferences({ editorFontSize }),
  setSimulatorPort: simulatorPort => window.api.setUiPreferences({ simulatorPort }),
}));

/** Open the preferences dialog (also File > Preferences, Ctrl+,). */
export function openPreferences() {
  window.dispatchEvent(new CustomEvent(AppEvent.openPreferences));
}

if (typeof window !== 'undefined') {
  window.addEventListener(AppEvent.uiPreferences, event => {
    const next = (event as CustomEvent<UiPreferences>).detail;
    apply(next);
    usePreferencesStore.setState({
      language: next.language,
      theme: next.theme,
      editorFontSize: next.editorFontSize,
      simulatorPort: next.simulatorPort,
    });
  });
}
