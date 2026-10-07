import { app, BrowserWindow, shell } from 'electron';
import { texts } from '../i18n';
import { staticPage } from '../paths';
import { getPreferences } from '../preferences';

export function openAboutWindow() {
  const aboutWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    autoHideMenuBar: true,
    title: texts().about,
    parent: BrowserWindow.getFocusedWindow() ?? undefined,
    backgroundColor: getPreferences().theme === 'dark' ? '#111827' : '#ffffff',
  });
  const { language, theme } = getPreferences();
  // The version shown is the app's (package.json), not one written into the page.
  aboutWindow.loadFile(staticPage('about.html'), {
    query: { lang: language, theme, version: app.getVersion() },
  });
  // Links in the page open in the system browser.
  aboutWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
}
