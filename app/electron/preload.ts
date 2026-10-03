// Preload script: the only bridge between the renderer and the main process.
// It exposes `window.api` (see shared/ipc.ts) and re-dispatches main-process
// messages as DOM events on `window`.
import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { AppEvent, IpcChannel, type RendererApi, type ServerLogPayload } from '../shared/ipc';

// A project path can arrive before React has mounted its listener; keep it until asked for.
let queuedProjectPath: string | null = null;

const api: RendererApi = {
  getFileList: path => ipcRenderer.invoke(IpcChannel.getFileList, path),
  createNewProject: () => ipcRenderer.invoke(IpcChannel.createNewProject),
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
};

// main -> renderer messages become DOM events of the same name.
ipcRenderer.on(AppEvent.serverLog, (_event, payload: ServerLogPayload) => {
  window.dispatchEvent(new CustomEvent(AppEvent.serverLog, { detail: payload }));
});

for (const event of [AppEvent.createNewProject, AppEvent.openProject, AppEvent.closeProject]) {
  ipcRenderer.on(event, () => {
    window.dispatchEvent(new CustomEvent(event));
  });
}

ipcRenderer.on(AppEvent.openProjectPath, (_event, sicPath: string) => {
  queuedProjectPath = sicPath;
  window.dispatchEvent(new CustomEvent(AppEvent.openProjectPath, { detail: sicPath }));
});

// With context isolation the API must go through contextBridge; without it, plain globals work.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error('Failed to expose Electron API in the renderer:', error);
  }
} else {
  const globals = window as unknown as { electron: typeof electronAPI; api: RendererApi };
  globals.electron = electronAPI;
  globals.api = api;
}
