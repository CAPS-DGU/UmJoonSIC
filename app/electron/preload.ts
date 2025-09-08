// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

type IpcApiResponse<T = void> = Promise<{
  success: boolean;
  data?: T;
  message?: string;
}>;

interface FileDevice {
  index: number;
  filename: string;
}

// Custom APIs for renderer
const api = {
  getFileList: (path: string): IpcApiResponse<string[]> => {
    return ipcRenderer.invoke('getFileList', path);
  },
  createNewProject: (): IpcApiResponse<{
    name: string;
    path: string;
    settings: {
      asm: string[];
      main: string;
      filedevices: FileDevice[];
    };
  }> => {
    return ipcRenderer.invoke('createNewProject');
  },
  readFile: (path: string): IpcApiResponse<string> => {
    return ipcRenderer.invoke('readFile', path);
  },
  saveFile: (path: string, content: string): IpcApiResponse<void> => {
    return ipcRenderer.invoke('saveFile', path, content);
  },
  openProject: (): IpcApiResponse<{
    name: string;
    path: string;
    settings: { asm: string[]; main: string; filedevices: FileDevice[] };
  }> => {
    return ipcRenderer.invoke('openProject');
  },
  loadAsm: (
    port: number,
    filePath: string,
  ): IpcApiResponse<{
    status?: number;
    data?: any;
  }> => {
    return ipcRenderer.invoke('loadAsm', { port, filePath });
  },
  createNewFile: (folderPath: string, fileName: string): IpcApiResponse<void> => {
    return ipcRenderer.invoke('createNewFile', { folderPath, fileName });
  },
  createNewFolder: (folderPath: string, folderName: string): IpcApiResponse<void> => {
    return ipcRenderer.invoke('createNewFolder', { folderPath, folderName });
  },
  deleteFile: (projectPath: string, relativePath: string): IpcApiResponse<void> => {
    return ipcRenderer.invoke('deleteFile', { projectPath, relativePath });
  },
  deleteFolder: (projectPath: string, relativePath: string): IpcApiResponse<void> => {
    return ipcRenderer.invoke('deleteFolder', { projectPath, relativePath });
  },
  pickFile: (): IpcApiResponse<string> => {
    return ipcRenderer.invoke('pickFile');
  },
  restartServer: (): IpcApiResponse<void> => {
    return ipcRenderer.invoke('restartServer');
  },
};

// 서버 로그 브릿지: IPC -> DOM 이벤트
ipcRenderer.on('server-log', (_event, payload: { type: 'out' | 'error'; message: string }) => {
  window.dispatchEvent(new CustomEvent('server-log', { detail: payload }));
});

// 새 프로젝트 생성 이벤트 리스너
ipcRenderer.on('create-new-project', () => {
  // 전역 이벤트 발생
  window.dispatchEvent(new CustomEvent('create-new-project'));
});

// 프로젝트 열기 이벤트 리스너
ipcRenderer.on('open-project', () => {
  window.dispatchEvent(new CustomEvent('open-project'));
});

// 프로젝트 닫기 이벤트 리스너
ipcRenderer.on('close-project', () => {
  window.dispatchEvent(new CustomEvent('close-project'));
});

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error('Failed to expose Electron API in the renderer:', error);
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
  // @ts-ignore (define in dts)
}
