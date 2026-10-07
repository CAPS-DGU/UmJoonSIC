// IPC: the app's preferences (language, theme, code font size, simulator port), and the
// restart a port change needs.
import { app, ipcMain } from 'electron';
import { IpcChannel, type UiPreferences } from '../../shared/ipc';
import { getPreferences, setPreferences } from '../preferences';
import { simulatorPort } from '../simulator/paths';
import { getMainWindow } from '../windows/mainWindow';

const intIn = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

export function registerPreferenceHandlers() {
  // Synchronous, so the page has them before its first paint.
  ipcMain.on(IpcChannel.getUiPreferences, event => {
    event.returnValue = getPreferences();
  });
  ipcMain.on(IpcChannel.setUiPreferences, (_event, change: Partial<UiPreferences>) => {
    const next: Partial<UiPreferences> = {};
    if (change.language === 'ko' || change.language === 'en') next.language = change.language;
    if (change.theme === 'light' || change.theme === 'dark') next.theme = change.theme;
    if (intIn(change.editorFontSize, 10, 28)) next.editorFontSize = change.editorFontSize;
    if (intIn(change.simulatorPort, 1024, 65535)) next.simulatorPort = change.simulatorPort;
    setPreferences(next);
  });
  ipcMain.on(IpcChannel.simulatorPortInUse, event => {
    event.returnValue = simulatorPort();
  });
  // The window closes as usual (unsaved changes are asked about); only once it is closed does
  // the app start again, so Cancel there cancels the restart too.
  ipcMain.on(IpcChannel.relaunchApp, () => {
    const window = getMainWindow();
    if (!window) return;
    window.once('closed', () => {
      app.relaunch();
      app.quit();
    });
    window.close();
  });
}
