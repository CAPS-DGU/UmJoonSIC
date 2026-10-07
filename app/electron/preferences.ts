// The user's interface settings (language, theme) and the list of recent projects. Kept by
// the main process in the app's data folder: the menus, the native dialogs and the start-up
// windows need them before (and besides) the page.
import fs from 'fs';
import path from 'path';
import { app, BrowserWindow, nativeTheme } from 'electron';
import { AppEvent, type RecentProject, type UiPreferences } from '../shared/ipc';

const RECENT_LIMIT = 8;

interface Stored {
  preferences?: Partial<UiPreferences>;
  recent?: RecentProject[];
}

let stored: Stored | null = null;
const listeners = new Set<(preferences: UiPreferences) => void>();

const storeFile = () => path.join(app.getPath('userData'), 'ui-preferences.json');

function load(): Stored {
  if (stored) return stored;
  try {
    stored = JSON.parse(fs.readFileSync(storeFile(), 'utf-8')) as Stored;
  } catch {
    stored = {};
  }
  return stored;
}

function save() {
  try {
    fs.mkdirSync(path.dirname(storeFile()), { recursive: true });
    fs.writeFileSync(storeFile(), JSON.stringify(load(), null, 2));
  } catch (error) {
    console.warn('The interface settings could not be saved:', error);
  }
}

/** Korean on a Korean system, English otherwise, until the user chooses. */
function defaultLanguage(): UiPreferences['language'] {
  const locale = app.isReady() ? app.getLocale() : (process.env.LANG ?? '');
  return locale.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

/** The editor's size before the setting existed. */
export const DEFAULT_EDITOR_FONT_SIZE = 12;
export const DEFAULT_SIMULATOR_PORT = 9090;

const intIn = (value: unknown, min: number, max: number, fallback: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max
    ? (value as number)
    : fallback;

export function getPreferences(): UiPreferences {
  const saved = load().preferences ?? {};
  return {
    language:
      saved.language === 'en' || saved.language === 'ko' ? saved.language : defaultLanguage(),
    theme: saved.theme === 'dark' || saved.theme === 'light' ? saved.theme : 'light',
    editorFontSize: intIn(saved.editorFontSize, 10, 28, DEFAULT_EDITOR_FONT_SIZE),
    simulatorPort: intIn(saved.simulatorPort, 1024, 65535, DEFAULT_SIMULATOR_PORT),
  };
}

/** Change the settings, keep them, and tell every window and listener (the menu). */
export function setPreferences(change: Partial<UiPreferences>) {
  const next = { ...getPreferences(), ...change };
  load().preferences = next;
  save();
  nativeTheme.themeSource = next.theme;
  listeners.forEach(listener => listener(next));
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) window.webContents.send(AppEvent.uiPreferences, next);
  });
}

export function onPreferencesChange(listener: (preferences: UiPreferences) => void) {
  listeners.add(listener);
}

/** Apply the saved theme to the native parts (dialogs, menus) at start-up. */
export function applyNativeTheme() {
  nativeTheme.themeSource = getPreferences().theme;
}

/** Remember a project that was opened (it moves to the top of the list). */
export function noteRecentProject(project: RecentProject) {
  const list = (load().recent ?? []).filter(p => p.sicPath !== project.sicPath);
  load().recent = [project, ...list].slice(0, RECENT_LIMIT);
  save();
}

/** Recent projects whose project.sic still exists, most recent first. */
export function getRecentProjects(): RecentProject[] {
  return (load().recent ?? []).filter(p => fs.existsSync(p.sicPath));
}
