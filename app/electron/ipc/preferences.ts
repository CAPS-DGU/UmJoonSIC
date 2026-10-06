// IPC: the interface settings (language, theme).
import { ipcMain } from 'electron';
import { IpcChannel, type UiPreferences } from '../../shared/ipc';
import { getPreferences, setPreferences } from '../preferences';

export function registerPreferenceHandlers() {
  // Synchronous, so the page has them before its first paint.
  ipcMain.on(IpcChannel.getUiPreferences, event => {
    event.returnValue = getPreferences();
  });
  ipcMain.on(IpcChannel.setUiPreferences, (_event, change: Partial<UiPreferences>) => {
    const next: Partial<UiPreferences> = {};
    if (change.language === 'ko' || change.language === 'en') next.language = change.language;
    if (change.theme === 'light' || change.theme === 'dark') next.theme = change.theme;
    setPreferences(next);
  });
}
