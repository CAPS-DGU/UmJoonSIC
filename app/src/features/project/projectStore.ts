import { create } from 'zustand';
import type { IpcResult, ProjectInfo, ProjectSettings } from '@shared/ipc';
import { simulator } from '@/api/simulator';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { resolveUnsavedChanges } from '@/features/editor/unsavedChanges';
import type { FileStructure } from '@/features/fileTree/types';
import { useErrorStore } from '@/features/panel/errorStore';

const EMPTY_SETTINGS: ProjectSettings = { asm: [], main: '', filedevices: [] };

/** The file list is read again shortly after opening: the first read can miss files still being written. */
const SECOND_REFRESH_DELAY_MS = 250;

interface ProjectState {
  /** Folder name of the open project; '' when no project is open. */
  projectName: string;
  /** Absolute path of the project folder. */
  projectPath: string;
  /** Contents of project.sic. */
  settings: ProjectSettings;
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
  addAsmFile: (file: FileStructure) => void;
  /** Drop files from the project's asm list (for example the files of a deleted folder). */
  removeAsmFiles: (relativePaths: string[]) => void;
  setSettings: (settings: ProjectSettings) => void;
  /** Write project.sic, then restart the simulation so new file devices take effect. */
  saveSettings: () => Promise<IpcResult>;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  /**
   * Leave the open project: deal with unsaved changes, then stop a run and close the
   * project's tabs and errors. False if the user cancelled.
   */
  const leaveProject = async () => {
    if (!get().projectPath) return true;
    if (!(await resolveUnsavedChanges())) return false;
    const { isRunning, stopRunning } = useRunningStore.getState();
    if (isRunning) await stopRunning();
    useEditorTabStore.getState().closeAllTabs();
    useErrorStore.getState().clearErrors();
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
    // Opening the project that is already open keeps its tabs.
    if (project.path !== get().projectPath && !(await leaveProject())) return;
    set({
      projectName: project.name,
      projectPath: project.path,
      settings: { ...project.settings },
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
        fileTree: [],
        selectedFileOrFolder: null,
      });
    },

    addAsmFile: file => {
      const { settings, fileTree, saveSettings } = get();
      if (file.type === 'file') {
        set({
          settings: { ...settings, asm: [...settings.asm, file.relativePath] },
          fileTree: [...fileTree, file],
        });
        saveSettings();
      }
    },

    removeAsmFiles: relativePaths => {
      const { settings, fileTree, saveSettings } = get();
      if (!settings.asm.some(p => relativePaths.includes(p))) return;
      set({
        settings: { ...settings, asm: settings.asm.filter(p => !relativePaths.includes(p)) },
        fileTree: fileTree.filter(f => !relativePaths.includes(f.relativePath)),
      });
      saveSettings();
    },

    setSettings: settings => set({ settings }),

    saveSettings: async () => {
      const { settings, projectPath } = get();
      const res = await window.api.saveFile(projectPath + '/project.sic', JSON.stringify(settings));
      if (res.success) {
        try {
          const { isRunning, stopRunning } = useRunningStore.getState();
          if (isRunning) {
            await stopRunning();
          }
          const { mode } = useMemoryViewStore.getState();
          const hasDevices = settings.filedevices && settings.filedevices.length > 0;
          await simulator.begin(
            mode,
            hasDevices
              ? settings.filedevices.map(fd => ({ index: fd.index, filename: fd.filename }))
              : undefined,
          );
        } catch (e) {
          console.warn('Failed to call /begin after saving settings:', e);
        }
      }
      return res;
    },
  };
});
