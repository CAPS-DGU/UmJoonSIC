import { create } from 'zustand';
import type { IpcResult, ProjectInfo, ProjectSettings } from '@shared/ipc';
import { simulator } from '@/api/simulator';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { cancelAllScheduledChecks } from '@/features/editor/lib/syntaxCheck';
import { resolveUnsavedChanges } from '@/features/editor/unsavedChanges';
import type { FileStructure } from '@/features/fileTree/types';
import { useListingStore } from '@/features/listing/listingStore';
import { useErrorStore } from '@/features/panel/errorStore';

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
  createNewProject: () => Promise<void>;
  openProject: () => Promise<void>;
  openProjectByPath: (sicPath: string) => Promise<void>;
  /** Close the project (asking about unsaved changes first). */
  closeProject: () => Promise<void>;
  /** Add a new file to the project's asm list, on disk at once. */
  addAsmFile: (file: FileStructure) => Promise<void>;
  /** Drop files from the project's asm list (the files of a deleted folder, say), on disk at once. */
  removeAsmFiles: (relativePaths: string[]) => Promise<void>;
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

  /** Change the asm list on disk and in the edited settings, leaving other edits unsaved. */
  const changeAsmList = async (change: (asm: string[]) => string[]) => {
    const { savedSettings, settings } = get();
    const saved = { ...savedSettings, asm: change(savedSettings.asm) };
    const res = await writeSettingsFile(saved);
    if (!res.success) {
      console.error('Failed to update project.sic:', res.message);
      return;
    }
    set({ savedSettings: saved, settings: { ...settings, asm: change(settings.asm) } });
  };

  /** Restart the simulation with the saved file devices (they are opened by /begin). */
  const applySettings = async () => {
    try {
      const { isRunning, stopRunning } = useRunningStore.getState();
      if (isRunning) {
        await stopRunning();
      }
      const { mode } = useMemoryViewStore.getState();
      const { filedevices } = get().savedSettings;
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
  const leaveProject = async () => {
    if (!get().projectPath) return true;
    if (!(await resolveUnsavedChanges())) return false;
    const { isRunning, stopRunning } = useRunningStore.getState();
    if (isRunning) await stopRunning();
    useEditorTabStore.getState().closeAllTabs();
    cancelAllScheduledChecks();
    useErrorStore.getState().clearErrors();
    useListingStore.getState().forgetBreakpoints();
    await useMemoryViewStore.getState().reload();
    return true;
  };

  /** Take over the project an IPC call returned (after leaving the open one), or log why not. */
  const adoptProject = async (request: Promise<IpcResult<ProjectInfo>>, action: string) => {
    let res: IpcResult<ProjectInfo>;
    try {
      res = await request;
    } catch (error) {
      console.error(`Error while trying to ${action}:`, error);
      return;
    }
    if (!res.success || !res.data) {
      console.error(`Failed to ${action}:`, res.message);
      return;
    }
    const project = res.data;
    // The project that is already open stays as it is (tabs, unsaved edits).
    if (project.path === get().projectPath) {
      get().refreshFileTree();
      return;
    }
    if (!(await leaveProject())) return;
    set({
      projectName: project.name,
      projectPath: project.path,
      settings: { ...project.settings },
      savedSettings: { ...project.settings },
      fileTree: [],
      selectedFileOrFolder: null,
    });
    get().refreshFileTree();
    setTimeout(() => get().refreshFileTree(), SECOND_REFRESH_DELAY_MS);
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

    createNewProject: () => adoptProject(window.api.createNewProject(), 'create new project'),
    openProject: () => adoptProject(window.api.openProject(), 'open project'),
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

    removeAsmFiles: async relativePaths => {
      if (!get().savedSettings.asm.some(p => relativePaths.includes(p))) return;
      await changeAsmList(asm => asm.filter(p => !relativePaths.includes(p)));
    },

    setSettings: settings => set({ settings }),

    saveSettings: async () => {
      const { settings } = get();
      const res = await writeSettingsFile(settings);
      if (res.success) {
        set({ savedSettings: settings });
        void applySettings();
      }
      return res;
    },

    discardSettingsChanges: () => set(state => ({ settings: state.savedSettings })),
  };
});
