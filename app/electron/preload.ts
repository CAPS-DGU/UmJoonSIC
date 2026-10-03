// Preload script: the only bridge between the renderer and the main process.
// It exposes `window.api` (see shared/ipc.ts) and re-dispatches main-process
// messages as DOM events on `window`.
import { contextBridge, ipcRenderer } from 'electron';
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
  waitForSimulator: () => ipcRenderer.invoke(IpcChannel.waitForSimulator),
  getServerLog: () => ipcRenderer.invoke(IpcChannel.getServerLog),
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

// The renderer runs with context isolation, so the API goes through contextBridge.
contextBridge.exposeInMainWorld('api', api);
