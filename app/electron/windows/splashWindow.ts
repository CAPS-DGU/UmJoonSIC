import { BrowserWindow } from 'electron';
import { staticPage } from '../paths';

let splashWindow: BrowserWindow | null = null;

/**
 * The start-up window. It has no frame (the image is the whole window) but behaves like
 * any other window: it is in the taskbar and the window switcher, so it can be minimised
 * and brought back, it can be dragged (splash.html), and it does not stay on top of other
 * programs. Closing it cancels the start (see main.ts).
 */
export function createSplashWindow(): BrowserWindow {
  splashWindow = new BrowserWindow({
    title: 'UmJoonSIC',
    width: 600,
    height: 400,
    autoHideMenuBar: true,
    frame: false,
    resizable: false,
    fullscreenable: false,
    maximizable: false,
  });
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
  return splashWindow;
}

/** The splash while the app starts; the download windows stay in front of it. */
export function getSplashWindow() {
  return splashWindow;
}

/** What the splash says at its bottom right; `failed` shows the heading in red. */
export interface SplashStatus {
  heading?: string;
  detail?: string;
  failed?: boolean;
}

let loaded: Promise<void> | null = null;

/**
 * Show a start-up status on the splash (the page has no script of its own: its CSP allows
 * none). False if there is no splash to show it on.
 */
export async function setSplashStatus(status: SplashStatus): Promise<boolean> {
  const splash = splashWindow;
  if (!splash || splash.isDestroyed() || !loaded) return false;
  await loaded;
  if (splash.isDestroyed()) return false;
  const js = `(() => {
    const s = ${JSON.stringify(status)};
    const box = document.getElementById('status');
    if (!box) return;
    if (s.heading !== undefined) document.getElementById('status-heading').textContent = s.heading;
    if (s.detail !== undefined) document.getElementById('status-detail').textContent = s.detail;
    box.classList.toggle('failed', !!s.failed);
    box.hidden = false;
  })()`;
  try {
    await splash.webContents.executeJavaScript(js);
    return true;
  } catch {
    return false;
  }
}

export function showSplashContent(splash: BrowserWindow) {
  loaded = new Promise(resolve => splash.webContents.once('did-finish-load', () => resolve()));
  splash.loadFile(staticPage('splash.html'));
  splash.center();
}
