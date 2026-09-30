import path from 'path';
import { app, BrowserWindow, shell } from 'electron';

export function openAboutWindow() {
  const aboutWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    autoHideMenuBar: true,
    title: 'About UmJoonSIC',
    parent: BrowserWindow.getFocusedWindow() ?? undefined,
  });
  aboutWindow.loadFile(path.join(app.getAppPath(), 'public/about.html'));
  // Links in the page open in the system browser.
  aboutWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
}
