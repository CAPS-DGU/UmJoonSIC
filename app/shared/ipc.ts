// Contract between the Electron main process, the preload script and the renderer.
// Imported by all three, so keep it free of runtime dependencies.

export interface FileDevice {
  index: number;
  filename: string;
}

/** The simulated machine: SIC, or its extension SIC/XE. */
export type MachineMode = 'SIC' | 'SICXE';

/** Contents of project.sic. `asm` paths are relative to the project root; `main` has no extension. */
export interface ProjectSettings {
  asm: string[];
  main: string;
  filedevices: FileDevice[];
  /** The machine the project is written for; a project.sic without it is SIC. */
  mode?: MachineMode;
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

/** One chunk of simulator output, numbered in the order the main process received it. */
export interface ServerLogPayload {
  seq: number;
  type: 'out' | 'error';
  message: string;
}

/** The answer to "save the unsaved changes?". */
export type UnsavedChangesChoice = 'save' | 'discard' | 'cancel';

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
  waitForSimulator: 'waitForSimulator',
  getServerLog: 'getServerLog',
  setHasUnsavedChanges: 'setHasUnsavedChanges',
  confirmUnsavedChanges: 'confirmUnsavedChanges',
  closeWindow: 'closeWindow',
  abortClose: 'abortClose',
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
  /** The window is about to close but the renderer reported unsaved changes. */
  closeRequested: 'close-requested',
  /** File > Close Tab (Ctrl+W). */
  closeActiveTab: 'close-active-tab',
  /** File > Next Tab, Previous Tab, Move Tab Right, Move Tab Left. */
  nextTab: 'next-tab',
  previousTab: 'previous-tab',
  moveTabRight: 'move-tab-right',
  moveTabLeft: 'move-tab-left',
} as const;

/** The object the preload script exposes as `window.api`. */
export interface RendererApi {
  getFileList(path: string): Promise<IpcResult<string[]>>;
  /** Ask where, then create a project for the given machine mode. */
  createNewProject(mode: MachineMode): Promise<IpcResult<ProjectInfo>>;
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
  /** Resolves once the simulator accepts requests (waits while it starts or restarts). */
  waitForSimulator(): Promise<IpcResult>;
  /** The simulator output so far (the most recent lines), oldest first. */
  getServerLog(): Promise<IpcResult<ServerLogPayload[]>>;
  /** Tell the main process whether closing the window would lose changes. */
  setHasUnsavedChanges(hasUnsavedChanges: boolean): void;
  /** Ask the user what to do with the unsaved changes of these files. */
  confirmUnsavedChanges(fileNames: string[]): Promise<IpcResult<UnsavedChangesChoice>>;
  /** Close the window after its unsaved changes have been dealt with. */
  closeWindow(): Promise<IpcResult>;
  /** The window stays open after all (the user cancelled, or saving failed). */
  abortClose(): void;
}
