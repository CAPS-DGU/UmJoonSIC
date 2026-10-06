// Preload script: the only bridge between the renderer and the main process.
// It exposes `window.api` (see shared/ipc.ts) and re-dispatches main-process
// messages as DOM events on `window`.
import { contextBridge, ipcRenderer } from 'electron';
import {
  AppEvent,
  IpcChannel,
  type RendererApi,
  type ServerLogPayload,
  type UiPreferences,
} from '../shared/ipc';

// A project path from outside the app (file association, second instance) waits here until
// the renderer takes it: it may arrive before React listens, and each path is opened once.
let queuedProjectPath: string | null = null;

const api: RendererApi = {
  getFileList: path => ipcRenderer.invoke(IpcChannel.getFileList, path),
  openProject: () => ipcRenderer.invoke(IpcChannel.openProject),
  openProjectByPath: sicPath => ipcRenderer.invoke(IpcChannel.openProjectByPath, sicPath),
  consumeQueuedProjectPath: () => {
    const current = queuedProjectPath;
    queuedProjectPath = null;
    return current;
  },
  readFile: path => ipcRenderer.invoke(IpcChannel.readFile, path),
  saveFile: (path, content) => ipcRenderer.invoke(IpcChannel.saveFile, path, content),
  createNewFile: (folderPath, fileName) =>
    ipcRenderer.invoke(IpcChannel.createNewFile, { folderPath, fileName }),
  createNewFolder: (folderPath, folderName) =>
    ipcRenderer.invoke(IpcChannel.createNewFolder, { folderPath, folderName }),
  deleteFile: (projectPath, relativePath) =>
    ipcRenderer.invoke(IpcChannel.deleteFile, { projectPath, relativePath }),
  deleteFolder: (projectPath, relativePath) =>
    ipcRenderer.invoke(IpcChannel.deleteFolder, { projectPath, relativePath }),
  pickFile: () => ipcRenderer.invoke(IpcChannel.pickFile),
  restartServer: () => ipcRenderer.invoke(IpcChannel.restartServer),
  waitForSimulator: () => ipcRenderer.invoke(IpcChannel.waitForSimulator),
  getServerLog: () => ipcRenderer.invoke(IpcChannel.getServerLog),
  setHasUnsavedChanges: hasUnsavedChanges =>
    ipcRenderer.send(IpcChannel.setHasUnsavedChanges, hasUnsavedChanges),
  setAsking: asking => ipcRenderer.send(IpcChannel.setAsking, asking),
  closeWindow: () => ipcRenderer.invoke(IpcChannel.closeWindow),
  abortClose: () => ipcRenderer.send(IpcChannel.abortClose),
  // Synchronous: the page applies the language and theme before its first paint.
  getUiPreferences: () => ipcRenderer.sendSync(IpcChannel.getUiPreferences) as UiPreferences,
  setUiPreferences: change => ipcRenderer.send(IpcChannel.setUiPreferences, change),
  getRecentProjects: () => ipcRenderer.invoke(IpcChannel.getRecentProjects),
  renamePath: (projectPath, relativePath, newName) =>
    ipcRenderer.invoke(IpcChannel.renamePath, { projectPath, relativePath, newName }),
  showInFolder: absolutePath => ipcRenderer.invoke(IpcChannel.showInFolder, absolutePath),
  pathExists: paths => ipcRenderer.invoke(IpcChannel.pathExists, paths),
  pickFolder: (title, defaultPath) =>
    ipcRenderer.invoke(IpcChannel.pickFolder, { title, defaultPath }),
  createProjectAt: (parentDir, name, mode) =>
    ipcRenderer.invoke(IpcChannel.createProjectAt, { parentDir, name, mode }),
};

// main -> renderer messages become DOM events of the same name.
ipcRenderer.on(AppEvent.serverLog, (_event, payload: ServerLogPayload) => {
  window.dispatchEvent(new CustomEvent(AppEvent.serverLog, { detail: payload }));
});

/**
 * One of the page's own modal dialogs is open (a question, an error, New Project, a name).
 * Menu commands and their keys wait until it closes, as they did behind the native boxes these
 * dialogs replace: F5 must not start a run behind "Save the changes?".
 */
const dialogOpen = () => document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;

// Closing the window is never held back: it asks about unsaved changes itself.
ipcRenderer.on(AppEvent.closeRequested, () => {
  window.dispatchEvent(new CustomEvent(AppEvent.closeRequested));
});

for (const event of [
  AppEvent.createNewProject,
  AppEvent.openProject,
  AppEvent.closeProject,
  AppEvent.closeActiveTab,
  AppEvent.nextTab,
  AppEvent.previousTab,
  AppEvent.moveTabRight,
  AppEvent.moveTabLeft,
  AppEvent.newFile,
  AppEvent.runStart,
  AppEvent.runPause,
  AppEvent.runStep,
  AppEvent.runRestart,
  AppEvent.runStop,
]) {
  ipcRenderer.on(event, () => {
    if (!dialogOpen()) window.dispatchEvent(new CustomEvent(event));
  });
}

// Messages with a payload: it becomes the event's detail.
for (const event of [AppEvent.runInterval, AppEvent.uiPreferences]) {
  ipcRenderer.on(event, (_event, payload: unknown) => {
    window.dispatchEvent(new CustomEvent(event, { detail: payload }));
  });
}

ipcRenderer.on(AppEvent.openProjectPath, (_event, sicPath: string) => {
  queuedProjectPath = sicPath;
  window.dispatchEvent(new CustomEvent(AppEvent.openProjectPath));
});

// The renderer runs with context isolation, so the API goes through contextBridge.
contextBridge.exposeInMainWorld('api', api);
