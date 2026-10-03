import { BrowserWindow } from 'electron';
import { rendererFile } from '../paths';

export function createSplashWindow(): BrowserWindow {
  return new BrowserWindow({
    width: 600,
    height: 400,
    autoHideMenuBar: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    maximizable: false,
  });
}

export function showSplashContent(splash: BrowserWindow) {
  splash.loadFile(rendererFile('splash.html'));
  splash.center();
}
