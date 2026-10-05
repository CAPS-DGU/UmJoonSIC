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

export function showSplashContent(splash: BrowserWindow) {
  splash.loadFile(staticPage('splash.html'));
  splash.center();
}
