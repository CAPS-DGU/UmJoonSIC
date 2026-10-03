import { BrowserWindow, shell } from 'electron';
import { is } from '@electron-toolkit/utils';
import { PRELOAD_PATH, rendererFile } from '../paths';

let mainWindow: BrowserWindow | null = null;

export function getMainWindow() {
  return mainWindow;
}

/** Create the main window hidden. The caller shows it once the simulator is up. */
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 640,
    // Below this the three columns no longer fit: tabs wrap and the bottom panel's tabs overlap.
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      // The preload is an ES module, which a sandboxed preload cannot be. Node stays out of
      // the page all the same: context isolation is on and node integration off (defaults).
      sandbox: false,
    },
  });
  mainWindow = window;

  // Links open in the system browser, never in a new app window.
  window.webContents.setWindowOpenHandler(details => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  window.on('closed', () => {
    mainWindow = null;
  });

  // electron-vite serves the renderer with HMR in development; production loads the built file.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    window.loadFile(rendererFile('index.html'));
  }
  return window;
}
