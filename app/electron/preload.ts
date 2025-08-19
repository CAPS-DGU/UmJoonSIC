import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

type IpcApiResponse<T = void> = Promise<{
  success: boolean;
  data?: T;
  message?: string;
}>;
// Custom APIs for renderer
const api = {
  getFileList: (path: string): IpcApiResponse<string[]> => {
    return ipcRenderer.invoke("getFileList", path);
  },
  createNewProject: (): IpcApiResponse<{
    name: string;
    path: string;
    settings: {
      asm: string[];
      main: string;
    };
  }> => {
    return ipcRenderer.invoke("createNewProject");
  }
}
// 새 프로젝트 생성 이벤트 리스너
ipcRenderer.on('create-new-project', () => {
  // 전역 이벤트 발생
  window.dispatchEvent(new CustomEvent('create-new-project'));
});

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error("Failed to expose Electron API in the renderer:", error);
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
  // @ts-ignore (define in dts)
}