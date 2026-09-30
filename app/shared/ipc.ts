// Contract between the Electron main process, the preload script and the renderer.
// Imported by all three, so keep it free of runtime dependencies.

export interface FileDevice {
  index: number;
  filename: string;
}

/** Contents of project.sic. `asm` paths are relative to the project root; `main` has no extension. */
export interface ProjectSettings {
  asm: string[];
  main: string;
  filedevices: FileDevice[];
}

export interface ProjectInfo {
  name: string;
  path: string;
  settings: ProjectSettings;
}

/** Every `window.api` call resolves to this shape; failures carry a message, never a rejection. */
export interface IpcResult<T = void> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ServerLogPayload {
  type: 'out' | 'error';
  message: string;
}

/** Request/response channels (renderer -> main). */
export const IpcChannel = {
  getFileList: 'getFileList',
  createNewProject: 'createNewProject',
  openProject: 'openProject',
  openProjectByPath: 'openProjectByPath',
  readFile: 'readFile',
  saveFile: 'saveFile',
  pickFile: 'pickFile',
  createNewFile: 'createNewFile',
  createNewFolder: 'createNewFolder',
  deleteFile: 'deleteFile',
  deleteFolder: 'deleteFolder',
  restartServer: 'restartServer',
} as const;

/**
 * Messages pushed from main to the renderer. The preload script re-dispatches each one
 * as a DOM CustomEvent of the same name on `window`.
 */
export const AppEvent = {
  serverLog: 'server-log',
  createNewProject: 'create-new-project',
  openProject: 'open-project',
  openProjectPath: 'open-project-path',
  closeProject: 'close-project',
} as const;

/** The object the preload script exposes as `window.api`. */
export interface RendererApi {
  getFileList(path: string): Promise<IpcResult<string[]>>;
  createNewProject(): Promise<IpcResult<ProjectInfo>>;
  openProject(): Promise<IpcResult<ProjectInfo>>;
  openProjectByPath(sicPath: string): Promise<IpcResult<ProjectInfo>>;
  /** A project path that arrived before the renderer was listening (file association, second instance). */
  consumeQueuedProjectPath(): string | null;
  readFile(path: string): Promise<IpcResult<string>>;
  saveFile(path: string, content: string): Promise<IpcResult>;
  createNewFile(folderPath: string, fileName: string): Promise<IpcResult>;
  createNewFolder(folderPath: string, folderName: string): Promise<IpcResult>;
  deleteFile(projectPath: string, relativePath: string): Promise<IpcResult>;
  deleteFolder(projectPath: string, relativePath: string): Promise<IpcResult>;
  pickFile(): Promise<IpcResult<string>>;
  restartServer(): Promise<IpcResult>;
}
