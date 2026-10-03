import { BrowserWindow, shell } from 'electron';
import { is } from '@electron-toolkit/utils';
import { AppEvent } from '../../shared/ipc';
import { PRELOAD_PATH, rendererFile } from '../paths';

let mainWindow: BrowserWindow | null = null;

/** Reported by the renderer: closing now would lose changes. */
let hasUnsavedChanges = false;
/** The renderer has dealt with the changes; the next close goes through. */
let closeAllowed = false;
/** A quit is under way (app 'before-quit'). */
let quitRequested = false;
/** The close that was held back was part of a quit, to be finished afterwards. */
let quitPending = false;

export function setHasUnsavedChanges(value: boolean) {
  hasUnsavedChanges = value;
  // macOS shows this in the window's close button.
  mainWindow?.setDocumentEdited(value);
}

export function noteQuitRequested() {
  quitRequested = true;
}

/** Close the main window without asking again. Returns true if a quit should follow. */
export function allowMainWindowClose(): boolean {
  closeAllowed = true;
  mainWindow?.close();
  const quit = quitPending;
  quitPending = false;
  return quit;
}

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
  hasUnsavedChanges = false;
  closeAllowed = false;

  // With unsaved changes, the renderer asks the user first (save / don't save / cancel)
  // and then closes the window through allowMainWindowClose().
  window.on('close', event => {
    if (!hasUnsavedChanges || closeAllowed) return;
    event.preventDefault();
    quitPending = quitRequested;
    quitRequested = false;
    window.webContents.send(AppEvent.closeRequested);
  });
  // A page that crashed, hangs or reloads cannot answer, and its changes are gone anyway:
  // do not hold the window open for it.
  const forgetChanges = () => setHasUnsavedChanges(false);
  window.webContents.on('render-process-gone', forgetChanges);
  window.on('unresponsive', forgetChanges);
  window.webContents.on('did-start-loading', forgetChanges);

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
