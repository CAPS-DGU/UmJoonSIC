// Opening from outside the app: a project.sic or an assembly file passed on the command line
// (file association, "Open with"), handed over by a second instance, or sent by macOS
// `open-file`. The request is held until the renderer has loaded, then sent exactly once;
// the renderer decides what to do with a file (projectStore.openFromOutside).
import path from 'path';
import fs from 'fs';
import { AppEvent, type OpenRequest } from '../../shared/ipc';
import { getMainWindow } from '../windows/mainWindow';
import { nearbyProject } from './nearbyProject';

const RETRY_DELAY_MS = 250;

let pendingRequest: OpenRequest | null = null;
let dispatchRetryTimer: NodeJS.Timeout | null = null;

export function hasPendingRequest() {
  return pendingRequest !== null;
}

/** What opening `rawPath` means: a project, an assembly file (with its project), or nothing. */
export function openRequestFor(rawPath: string): OpenRequest | null {
  const cleaned = rawPath.replace(/^['"]|['"]$/g, '');
  const lower = cleaned.toLowerCase();
  if (!lower.endsWith('.sic') && !lower.endsWith('.asm')) return null;
  const resolved = path.resolve(cleaned);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    console.warn('[UmJoonSIC] file to open not found:', resolved);
    return null;
  }
  return lower.endsWith('.sic')
    ? { kind: 'project', path: resolved }
    : { kind: 'file', path: resolved, project: nearbyProject(resolved) };
}

/** The first project.sic or .asm among the arguments (argv[0] is the executable). */
export function findOpenRequestInArgs(argv: string[]): OpenRequest | null {
  for (let i = 1; i < argv.length; i++) {
    if (!argv[i] || argv[i].startsWith('-')) continue;
    const request = openRequestFor(argv[i]);
    if (request) return request;
  }
  return null;
}

/** Remember a request found before the main window exists (startup arguments). */
export function setInitialRequest(request: OpenRequest) {
  pendingRequest = request;
}

export function cancelPendingDispatch() {
  if (dispatchRetryTimer) {
    clearTimeout(dispatchRetryTimer);
    dispatchRetryTimer = null;
  }
}

/** Send the pending request to the renderer, retrying while the page is still loading. */
export function sendPendingRequest() {
  const mainWindow = getMainWindow();
  if (!mainWindow || !pendingRequest) return;
  if (mainWindow.webContents.isLoadingMainFrame()) {
    if (!dispatchRetryTimer) {
      dispatchRetryTimer = setTimeout(() => {
        dispatchRetryTimer = null;
        sendPendingRequest();
      }, RETRY_DELAY_MS);
    }
    return;
  }
  if (!fs.existsSync(pendingRequest.path)) {
    console.warn('File to open no longer exists:', pendingRequest.path);
    pendingRequest = null;
    return;
  }
  mainWindow.webContents.send(AppEvent.openRequest, pendingRequest);
  pendingRequest = null;
  cancelPendingDispatch();
}

/** Queue a request; if the main window exists, deliver it and bring the window forward. */
export function queueOpen(request: OpenRequest | null = pendingRequest) {
  if (!request) return;
  pendingRequest = request;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    sendPendingRequest();
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
}
