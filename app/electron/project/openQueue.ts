// Opening a project from outside the app: a project.sic passed on the command line
// (file association), handed over by a second instance, or sent by macOS `open-file`.
// The path is held until the renderer has loaded, then sent exactly once.
import path from 'path';
import fs from 'fs';
import { AppEvent } from '../../shared/ipc';
import { getMainWindow } from '../windows/mainWindow';

const RETRY_DELAY_MS = 250;

let pendingProjectSicPath: string | null = null;
let dispatchRetryTimer: NodeJS.Timeout | null = null;

export function hasPendingProjectPath() {
  return pendingProjectSicPath !== null;
}

/** First existing `.sic` path among the arguments (argv[0] is the executable). */
export function findSicPathInArgs(argv: string[]): string | null {
  for (let i = 1; i < argv.length; i++) {
    const rawArg = argv[i];
    if (!rawArg) continue;
    const cleaned = rawArg.replace(/^['"]|['"]$/g, '');
    if (!cleaned.toLowerCase().endsWith('.sic')) continue;
    const resolved = path.resolve(cleaned);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
    console.warn('[UmJoonSIC] project.sic argument found but file missing:', resolved);
  }
  return null;
}

/** Remember a path found before the main window exists (startup arguments). */
export function setInitialProjectPath(sicPath: string) {
  pendingProjectSicPath = sicPath;
}

export function cancelPendingDispatch() {
  if (dispatchRetryTimer) {
    clearTimeout(dispatchRetryTimer);
    dispatchRetryTimer = null;
  }
}

/** Send the pending path to the renderer, retrying while the page is still loading. */
export function sendPendingProjectPath() {
  const mainWindow = getMainWindow();
  if (!mainWindow || !pendingProjectSicPath) return;
  if (mainWindow.webContents.isLoadingMainFrame()) {
    if (!dispatchRetryTimer) {
      dispatchRetryTimer = setTimeout(() => {
        dispatchRetryTimer = null;
        sendPendingProjectPath();
      }, RETRY_DELAY_MS);
    }
    return;
  }
  if (!fs.existsSync(pendingProjectSicPath)) {
    console.warn('Requested project.sic file no longer exists:', pendingProjectSicPath);
    pendingProjectSicPath = null;
    return;
  }
  mainWindow.webContents.send(AppEvent.openProjectPath, pendingProjectSicPath);
  pendingProjectSicPath = null;
  cancelPendingDispatch();
}

/** Queue a project to open; if the main window exists, deliver it and bring the window forward. */
export function queueProjectOpen(inputPath: string | null = pendingProjectSicPath) {
  if (!inputPath) return;
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    console.warn('Requested project.sic file not found:', resolved);
    return;
  }
  pendingProjectSicPath = resolved;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    sendPendingProjectPath();
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
}
