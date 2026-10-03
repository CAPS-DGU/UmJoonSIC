import { create } from 'zustand';
import type { IpcResult, ProjectInfo, ProjectSettings } from '@shared/ipc';
import { simulator } from '@/api/simulator';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRunningStore } from '@/features/debugger/runningStore';
import type { FileStructure } from '@/features/fileTree/types';

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
  createNewProject: () => void;
  openProject: () => void;
  openProjectByPath: (sicPath: string) => void;
  closeProject: () => void;
  addAsmFile: (file: FileStructure) => void;
  removeAsmFile: (relativePath: string) => void;
  setSettings: (settings: ProjectSettings) => void;
  /** Write project.sic, then restart the simulation so new file devices take effect. */
  saveSettings: () => Promise<IpcResult>;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  /** Take over the project an IPC call returned, or log why it failed. */
  const adoptProject = (request: Promise<IpcResult<ProjectInfo>>, action: string) => {
    request
      .then(res => {
        if (res.success && res.data) {
          set({
            projectName: res.data.name,
            projectPath: res.data.path,
            settings: { ...res.data.settings },
            fileTree: [],
          });
          get().refreshFileTree();
          setTimeout(() => get().refreshFileTree(), SECOND_REFRESH_DELAY_MS);
        } else {
          console.error(`Failed to ${action}:`, res.message);
        }
      })
      .catch((error: unknown) => {
        console.error(`Error while trying to ${action}:`, error);
      });
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
    openProjectByPath: sicPath => {
      if (!sicPath) {
        console.error('Invalid project path received');
        return;
      }
      adoptProject(window.api.openProjectByPath(sicPath), 'open project by path');
    },

    closeProject: () => {
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

    removeAsmFile: relativePath => {
      const { settings, fileTree, saveSettings } = get();
      set({
        settings: { ...settings, asm: settings.asm.filter(p => p !== relativePath) },
        fileTree: fileTree.filter(f => f.relativePath !== relativePath),
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
