import { app, BrowserWindow, shell } from 'electron';
import { is } from '@electron-toolkit/utils';
import { AppEvent } from '../../shared/ipc';
import { PRELOAD_PATH, rendererFile } from '../paths';

let mainWindow: BrowserWindow | null = null;

// Closing with unsaved changes: the window's close is held back and the page asks the user
// (save / don't save / cancel), then closes the window through allowMainWindowClose().

/** How long the page has to start asking before the window closes anyway (page broken). */
const CLOSE_ANSWER_TIMEOUT_MS = 3000;

/** Reported by the renderer: closing now would lose changes. */
let hasUnsavedChanges = false;
/** The renderer has dealt with the changes; the next close goes through. */
let closeAllowed = false;
/** A quit is under way (app 'before-quit'). */
let quitRequested = false;
/** The close that was held back was part of a quit, to be finished afterwards. */
let quitPending = false;
/** The page hangs: it could not answer, so a close is not held back meanwhile. */
let isUnresponsive = false;
/** The page is asking the user (its dialog is open). */
let isAsking = false;
let closeFallbackTimer: NodeJS.Timeout | null = null;

const clearCloseFallback = () => {
  if (closeFallbackTimer) clearTimeout(closeFallbackTimer);
  closeFallbackTimer = null;
};

export function setHasUnsavedChanges(value: boolean) {
  hasUnsavedChanges = value;
  // macOS shows this in the window's close button.
  mainWindow?.setDocumentEdited(value);
}

export function noteQuitRequested() {
  quitRequested = true;
}

export function noteAsking(asking: boolean) {
  isAsking = asking;
  if (asking) clearCloseFallback();
}

/** The user cancelled: the window stays, and a quit that was under way is off. */
export function cancelMainWindowClose() {
  clearCloseFallback();
  quitPending = false;
}

/** Close the main window without asking again. Returns true if a quit should follow. */
export function allowMainWindowClose(): boolean {
  clearCloseFallback();
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

  window.on('close', event => {
    if (!hasUnsavedChanges || closeAllowed || isUnresponsive) return;
    event.preventDefault();
    quitPending = quitRequested;
    quitRequested = false;
    window.webContents.send(AppEvent.closeRequested);
    // A page that lost its handlers (a crashed React tree) never asks: do not keep the
    // window (and the app) from closing for good.
    clearCloseFallback();
    closeFallbackTimer = setTimeout(() => {
      if (!isAsking && allowMainWindowClose()) app.quit();
    }, CLOSE_ANSWER_TIMEOUT_MS);
  });
  // A crashed or reloaded page has lost its changes; a hanging one cannot answer for now.
  const forgetChanges = () => setHasUnsavedChanges(false);
  window.webContents.on('render-process-gone', forgetChanges);
  window.webContents.on('did-start-loading', forgetChanges);
  window.on('unresponsive', () => (isUnresponsive = true));
  window.on('responsive', () => (isUnresponsive = false));

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
