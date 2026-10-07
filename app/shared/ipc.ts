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
  /** What went wrong, for the page to explain it in its language (e.g. 'invalidJson'). */
  code?: string;
}

/** One chunk of simulator output, numbered in the order the main process received it. */
export interface ServerLogPayload {
  seq: number;
  type: 'out' | 'error';
  message: string;
}

/** The answer to "save the unsaved changes?". */
export type UnsavedChangesChoice = 'save' | 'discard' | 'cancel';

/** The interface language: Korean, or English throughout. */
export type UiLanguage = 'ko' | 'en';
/** Light or dark colours for every window. */
export type UiTheme = 'light' | 'dark';

/** The user's interface settings, kept by the main process (it also needs them before the page loads). */
export interface UiPreferences {
  language: UiLanguage;
  theme: UiTheme;
}

/** A project the user opened before (the welcome screen lists them). */
export interface RecentProject {
  name: string;
  /** Absolute path of its project.sic. */
  sicPath: string;
}

/** Request/response channels (renderer -> main). */
export const IpcChannel = {
  getFileList: 'getFileList',
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
  setAsking: 'setAsking',
  closeWindow: 'closeWindow',
  abortClose: 'abortClose',
  getUiPreferences: 'getUiPreferences',
  setUiPreferences: 'setUiPreferences',
  getRecentProjects: 'getRecentProjects',
  renamePath: 'renamePath',
  showInFolder: 'showInFolder',
  pathExists: 'pathExists',
  pickFolder: 'pickFolder',
  createProjectAt: 'createProjectAt',
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
  /** The interface settings changed (from the menu or another window); payload: UiPreferences. */
  uiPreferences: 'ui-preferences',
  /** File > New File (Ctrl+N). */
  newFile: 'new-file',
  /** The Run menu (F5, F6, F10, Ctrl+Shift+F5, Shift+F5) and its interval list (payload: ms). */
  runStart: 'run-start',
  runPause: 'run-pause',
  runStep: 'run-step',
  runRestart: 'run-restart',
  runStop: 'run-stop',
  runInterval: 'run-interval',
} as const;

/** Options of window.api.pickFile. */
export interface PickFileOptions {
  /** The folder the dialog opens in (the project folder). */
  defaultPath?: string;
  /** A Save dialog: the file may not exist yet (an output device's file). */
  save?: boolean;
  /** The name filled in, with `save`. */
  suggestedName?: string;
}

/** The object the preload script exposes as `window.api`. */
export interface RendererApi {
  getFileList(path: string): Promise<IpcResult<string[]>>;
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
  /** A file chosen in the system's dialog (an Open dialog, or a Save dialog with `save`). */
  pickFile(options?: PickFileOptions): Promise<IpcResult<string>>;
  restartServer(): Promise<IpcResult>;
  /** Resolves once the simulator accepts requests (waits while it starts or restarts). */
  waitForSimulator(): Promise<IpcResult>;
  /** The simulator output so far (the most recent lines), oldest first. */
  getServerLog(): Promise<IpcResult<ServerLogPayload[]>>;
  /** Tell the main process whether closing the window would lose changes. */
  setHasUnsavedChanges(hasUnsavedChanges: boolean): void;
  /** The page is asking the user (its unsaved-changes dialog is open): a close waits for the answer. */
  setAsking(asking: boolean): void;
  /** Close the window after its unsaved changes have been dealt with. */
  closeWindow(): Promise<IpcResult>;
  /** The window stays open after all (the user cancelled, or saving failed). */
  abortClose(): void;
  /** The interface settings, available at once (read when the page loads). */
  getUiPreferences(): UiPreferences;
  /** Change interface settings; every window follows (menus, dialogs, other windows). */
  setUiPreferences(change: Partial<UiPreferences>): void;
  /** Projects opened before, most recent first (missing ones are left out). */
  getRecentProjects(): Promise<IpcResult<RecentProject[]>>;
  /** Rename a file or folder inside the project (`newName` is a name, not a path). */
  renamePath(projectPath: string, relativePath: string, newName: string): Promise<IpcResult>;
  /** Show a file or folder in the system's file manager. */
  showInFolder(absolutePath: string): Promise<IpcResult>;
  /** Which of these absolute paths exist (true/false, in order). */
  pathExists(paths: string[]): Promise<IpcResult<boolean[]>>;
  /** Ask for a folder (the location of a new project); resolves to its path, or fails when cancelled. */
  pickFolder(title: string, defaultPath?: string): Promise<IpcResult<string>>;
  /** Create the project `name` in `parentDir` for the given machine mode. */
  createProjectAt(
    parentDir: string,
    name: string,
    mode: MachineMode,
  ): Promise<IpcResult<ProjectInfo>>;
}
