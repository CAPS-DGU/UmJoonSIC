import { create } from 'zustand';
import type { IpcResult, MachineMode, ProjectInfo, ProjectSettings } from '@shared/ipc';
import { simulator } from '@/api/simulator';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { cancelAllScheduledChecks } from '@/features/editor/lib/syntaxCheck';
import { resolveUnsavedChanges } from '@/features/editor/unsavedChanges';
import type { FileStructure } from '@/features/fileTree/types';
import { useListingStore } from '@/features/listing/listingStore';
import { useErrorStore } from '@/features/panel/errorStore';
import { strings } from '@/i18n';
import { resolveInProject } from '@/lib/projectPath';
import { dismissAllDialogs, showError } from '@/stores/dialogStore';
import { dismissAllToasts } from '@/stores/toastStore';

const EMPTY_SETTINGS: ProjectSettings = { asm: [], main: '', filedevices: [] };

/** The file list is read again shortly after opening: the first read can miss files still being written. */
const SECOND_REFRESH_DELAY_MS = 250;

interface ProjectState {
  /** Folder name of the open project; '' when no project is open. */
  projectName: string;
  /** Absolute path of the project folder. */
  projectPath: string;
  /** Contents of project.sic, with the edits of the settings form that are not saved yet. */
  settings: ProjectSettings;
  /** Contents of project.sic as written on disk. */
  savedSettings: ProjectSettings;
  /** Flat list of the project's files and folders (folders end with '/'). */
  fileTree: FileStructure[];
  selectedFileOrFolder: FileStructure | null;

  setSelectedFileOrFolder: (item: FileStructure | null) => void;
  refreshFileTree: () => void;
  /** The New Project dialog is open (NewProjectDialog.tsx). */
  newProjectOpen: boolean;
  /** Open the New Project dialog. */
  createNewProject: () => Promise<void>;
  closeNewProject: () => void;
  /** Create a project (from the New Project dialog) and open it. */
  createProjectAt: (
    parentDir: string,
    name: string,
    mode: MachineMode,
  ) => Promise<IpcResult<ProjectInfo>>;
  openProject: () => Promise<void>;
  openProjectByPath: (sicPath: string) => Promise<void>;
  /** Close the project (asking about unsaved changes first). */
  closeProject: () => Promise<void>;
  /** Add a new file to the project's asm list, on disk at once. */
  addAsmFile: (file: FileStructure) => Promise<void>;
  /** Drop files from the project's asm list (the files of a deleted folder, say), on disk at once. */
  removeAsmFiles: (relativePaths: string[]) => Promise<void>;
  /** A file or folder was renamed: its paths in the asm list follow, on disk at once. */
  renameAsmPaths: (from: string, to: string) => Promise<void>;
  /** Switch the machine mode; an open project remembers it (in project.sic, on disk at once). */
  changeMode: (mode: MachineMode) => Promise<void>;
  /** Edit the settings (the settings form); saveSettings writes them. */
  setSettings: (settings: ProjectSettings) => void;
  /** Write the edited settings to project.sic; then the simulation restarts with them. */
  saveSettings: () => Promise<IpcResult>;
  /** Drop the edits of the settings form. */
  discardSettingsChanges: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  const writeSettingsFile = (settings: ProjectSettings) =>
    window.api.saveFile(get().projectPath + '/project.sic', JSON.stringify(settings));

  /** Writes of project.sic, one after another (changeSavedSettings, saveSettings). */
  let settingsWrites: Promise<void> = Promise.resolve();

  /**
   * Change some settings on disk at once, and in the edited settings too; the other edits
   * of the settings form stay unsaved. `change` runs when it is this write's turn, so it
   * sees the earlier writes.
   */
  const changeSavedSettings = (change: (settings: ProjectSettings) => Partial<ProjectSettings>) => {
    const { projectPath } = get();
    const write = settingsWrites.then(async () => {
      // Another project was opened meanwhile.
      if (get().projectPath !== projectPath) return;
      const { savedSettings } = get();
      const patch = change(savedSettings);
      const keys = Object.keys(patch) as (keyof ProjectSettings)[];
      if (keys.every(key => patch[key] === savedSettings[key])) return;
      const saved = { ...savedSettings, ...patch };
      const res = await writeSettingsFile(saved);
      if (!res.success) {
        console.error('Failed to update project.sic:', res.message);
        return;
      }
      if (get().projectPath !== projectPath) return;
      set(state => ({
        savedSettings: saved,
        settings: { ...state.settings, ...change(state.settings) },
      }));
    });
    settingsWrites = write.catch(() => {});
    return write;
  };

  const changeAsmList = (change: (asm: string[]) => string[]) =>
    changeSavedSettings(settings => ({ asm: change(settings.asm) }));

  /** Restart the simulation with the saved file devices (they are opened by /begin). */
  const applySettings = async () => {
    try {
      const { isRunning, stopRunning } = useRunningStore.getState();
      if (isRunning) {
        await stopRunning();
      }
      const { mode } = useMemoryViewStore.getState();
      // Relative device paths are inside the project (the simulator would open them in its
      // own working folder).
      const filedevices = get().savedSettings.filedevices.map(device => ({
        ...device,
        filename: resolveInProject(get().projectPath, device.filename),
      }));
      await simulator.begin(mode, filedevices.length > 0 ? filedevices : undefined);
    } catch (e) {
      console.warn('Failed to call /begin after saving settings:', e);
    }
  };

  /**
   * Leave the open project: deal with unsaved changes, then stop a run and close what
   * belongs to the project (tabs, errors, breakpoints, pending checks). False if the user
   * cancelled.
   */
  const leaveProject = async (unsavedResolved = false) => {
    if (!get().projectPath) return true;
    // `unsavedResolved`: the caller asked already (before its file picker), do not ask twice.
    if (!unsavedResolved && !(await resolveUnsavedChanges())) return false;
    // The project's messages, run and registers do not carry over to the next one.
    dismissAllDialogs();
    dismissAllToasts();
    // Also while a program is still being assembled: its load must not land in the next project.
    const { isRunning, isStarting, stopRunning } = useRunningStore.getState();
    if (isRunning || isStarting) await stopRunning();
    useRegisterStore
      .getState()
      .setAll({ A: 0, X: 0, L: 0, S: 0, T: 0, B: 0, SW: 0, PC: 0, F: '0' });
    useRegisterStore.getState().clearChangedRegisters();
    useEditorTabStore.getState().closeAllTabs();
    cancelAllScheduledChecks();
    useErrorStore.getState().clearErrors();
    useListingStore.getState().forgetBreakpoints();
    await useMemoryViewStore.getState().reload();
    return true;
  };

  /** Say why a project could not be opened (a cancelled picker says nothing). */
  const explainOpenFailure = (res: IpcResult<unknown>) => {
    if (res.code === 'canceled') return;
    const t = strings();
    const detail =
      res.code === 'notFound'
        ? t.messages.projectNotFound(res.message ?? '')
        : res.code === 'invalidJson'
          ? t.messages.projectInvalidJson(res.message ?? '')
          : res.message;
    void showError(t.messages.projectOpenFailed, detail);
  };

  /** Take over the project an IPC call returned (after leaving the open one), or say why not. */
  const adoptProject = async (
    request: Promise<IpcResult<ProjectInfo>>,
    action: string,
    unsavedResolved = false,
  ) => {
    let res: IpcResult<ProjectInfo>;
    try {
      res = await request;
    } catch (error) {
      console.error(`Error while trying to ${action}:`, error);
      explainOpenFailure({ success: false, message: String(error) });
      return;
    }
    if (!res.success || !res.data) {
      explainOpenFailure(res);
      return;
    }
    const project = res.data;
    // The project that is already open stays as it is (tabs, unsaved edits).
    if (project.path === get().projectPath) {
      get().refreshFileTree();
      return;
    }
    if (!(await leaveProject(unsavedResolved))) return;
    set({
      projectName: project.name,
      projectPath: project.path,
      settings: { ...project.settings },
      savedSettings: { ...project.settings },
      fileTree: [],
      selectedFileOrFolder: null,
    });
    // The project's machine mode; a project.sic that does not say is SIC.
    const mode = project.settings.mode ?? 'SIC';
    if (mode !== useMemoryViewStore.getState().mode) {
      useMemoryViewStore.getState().setMode(mode);
    }
    get().refreshFileTree();
    setTimeout(() => get().refreshFileTree(), SECOND_REFRESH_DELAY_MS);
    // Open the program to work on: the main module's file (or the first listed one).
    const { asm, main } = project.settings;
    const mainFile =
      asm.find(
        file =>
          file
            .replace(/\.asm$/i, '')
            .split('/')
            .pop() === main,
      ) ?? asm[0];
    if (mainFile) {
      const exists = await window.api.pathExists([`${project.path}/${mainFile}`]);
      if (exists.success && exists.data?.[0] && get().projectPath === project.path) {
        void useEditorTabStore
          .getState()
          .openTab({ title: mainFile.split('/').pop()!, filePath: mainFile });
      }
    }
  };

  return {
    projectName: '',
    projectPath: '',
    settings: EMPTY_SETTINGS,
    savedSettings: EMPTY_SETTINGS,
    fileTree: [],
    selectedFileOrFolder: null,

    setSelectedFileOrFolder: item => set({ selectedFileOrFolder: item }),

    refreshFileTree: () => {
      const { projectPath } = get();
      if (!projectPath) {
        console.warn('Project path is empty');
        return;
      }

      window.api
        .getFileList(projectPath)
        .then(res => {
          if (res.success && res.data) {
            // Folders are recognised later by their trailing '/' (see useFileTree).
            const fileTree: FileStructure[] = res.data.map(entry => ({
              type: 'file',
              name: entry.split('/').pop() || entry,
              relativePath: entry,
            }));
            set({ fileTree });
          } else {
            console.error('Failed to get file list:', res.message);
            set({ fileTree: [] });
          }
        })
        .catch((error: unknown) => {
          console.error('Error getting file list:', error);
          set({ fileTree: [] });
        });
    },

    newProjectOpen: false,
    createNewProject: async () => set({ newProjectOpen: true }),
    closeNewProject: () => set({ newProjectOpen: false }),
    createProjectAt: async (parentDir, name, mode) => {
      // Unsaved changes are dealt with before anything is created.
      if (get().projectPath && !(await resolveUnsavedChanges())) {
        return { success: false, code: 'canceled' };
      }
      const res = await window.api.createProjectAt(parentDir, name, mode);
      if (res.success && res.data) {
        set({ newProjectOpen: false });
        useMemoryViewStore.getState().setMode(mode);
        await adoptProject(Promise.resolve(res), 'create project', true);
      }
      return res;
    },
    // The unsaved changes are dealt with first, then the file picker: not the other way round.
    openProject: async () => {
      if (get().projectPath && !(await resolveUnsavedChanges())) return;
      await adoptProject(window.api.openProject(), 'open project', true);
    },
    openProjectByPath: async sicPath => {
      if (!sicPath) {
        console.error('Invalid project path received');
        return;
      }
      await adoptProject(window.api.openProjectByPath(sicPath), 'open project by path');
    },

    closeProject: async () => {
      if (!(await leaveProject())) return;
      set({
        projectName: '',
        projectPath: '',
        settings: EMPTY_SETTINGS,
        savedSettings: EMPTY_SETTINGS,
        fileTree: [],
        selectedFileOrFolder: null,
      });
    },

    addAsmFile: async file => {
      if (file.type !== 'file') return;
      await changeAsmList(asm =>
        asm.includes(file.relativePath) ? asm : [...asm, file.relativePath],
      );
    },

    renameAsmPaths: async (from, to) => {
      const renamed = (p: string) =>
        p === from ? to : p.startsWith(`${from}/`) ? to + p.slice(from.length) : p;
      if (!get().savedSettings.asm.some(p => renamed(p) !== p)) return;
      await changeAsmList(asm => asm.map(renamed));
    },

    removeAsmFiles: async relativePaths => {
      if (!get().savedSettings.asm.some(p => relativePaths.includes(p))) return;
      await changeAsmList(asm => asm.filter(p => !relativePaths.includes(p)));
    },

    changeMode: async mode => {
      useMemoryViewStore.getState().setMode(mode);
      if (get().projectPath) {
        // The mode when the write's turn comes: after a quick change back, nothing is written.
        await changeSavedSettings(() => ({ mode: useMemoryViewStore.getState().mode }));
      }
    },

    setSettings: settings => set({ settings }),

    saveSettings: () => {
      const { projectPath } = get();
      // After the changes already on their way to disk (the mode, say), so as not to undo them.
      const save = settingsWrites.then(async (): Promise<IpcResult> => {
        if (get().projectPath !== projectPath) {
          return { success: false, message: strings().messages.settingsProjectChanged };
        }
        const { settings } = get();
        const res = await writeSettingsFile(settings);
        if (res.success) {
          set({ savedSettings: settings });
          void applySettings();
        }
        return res;
      });
      settingsWrites = save.then(
        () => {},
        () => {},
      );
      return save;
    },

    discardSettingsChanges: () => set(state => ({ settings: state.savedSettings })),
  };
});
