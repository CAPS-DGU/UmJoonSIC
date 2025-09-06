// src/stores/ProjectStore.ts
import { create } from 'zustand';
import type { FileStructure } from '@/types/fileTree';

interface ProjectState {
  projectName: string;
  projectPath: string;
  settings: { asm: string[]; main: string };
  fileTree: FileStructure[];
  selectedFileOrFolder: FileStructure | null;
  setSelectedFileOrFolder: (item: FileStructure | null) => void;
  getFolderFromSelectedFileOrFolder: () => string;
  refreshFileTree: () => void;
  refreshSettings: () => void;
  setProject: (project: ProjectState) => void;
  createNewProject: () => void;
  openProject: () => void;
  closeProject: () => void;
  getAsmAbsolutePaths: () => string[];
  addAsmFile: (file: FileStructure) => void;
  saveSettings: () => Promise<{ success: boolean; message?: string }>;
  setSettings: (settings: { asm: string[]; main: string }) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectName: '',
  projectPath: '',
  settings: { asm: [], main: '' },
  fileTree: [],
  selectedFileOrFolder: null as FileStructure | null,
  setSelectedFileOrFolder: (item: FileStructure | null) => set({ selectedFileOrFolder: item }),
  getFolderFromSelectedFileOrFolder: () => {
    const { selectedFileOrFolder } = get();
    if (!selectedFileOrFolder) return '/';

    if (selectedFileOrFolder.type === 'folder') {
      return selectedFileOrFolder.relativePath;
    } else {
      const parts = selectedFileOrFolder.relativePath.split('/');
      parts.pop();
      return parts.length === 0 ? '/' : parts.join('/');
    }
  },
  addAsmFile: (file: FileStructure) => {
    const { settings, fileTree, saveSettings } = get();
    if (file.type === 'file') {
      set({
        settings: { ...settings, asm: [...settings.asm, file.relativePath] },
        fileTree: [...fileTree, file],
      });
      saveSettings();
    }
  },
  saveSettings: () => {
    const { settings, projectPath } = get();
    return window.api.saveFile(projectPath + '/project.sic', JSON.stringify(settings));
  },
  refreshFileTree: () => {
    const currentPath = get().projectPath;
    if (!currentPath) {
      console.warn('Project path is empty');
      return;
    }
    window.api
      .getFileList(currentPath)
      .then(res => {
        if (res.success && res.data) {
          const fileTree: FileStructure[] = res.data.map(pathStr => ({
            type: 'file', // 또는 folder인지 판단해서 동적으로
            name: pathStr.split('/').pop() || pathStr,
            relativePath: pathStr,
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

  refreshSettings: () => set({ settings: { asm: [], main: '' } }),

  setProject: (project: ProjectState) =>
    set({
      projectName: project.projectName,
      projectPath: project.projectPath,
      settings: project.settings,
    }),

  createNewProject: () => {
    window.api
      .createNewProject()
      .then(res => {
        if (res.success && res.data) {
          set({
            projectName: res.data.name,
            projectPath: res.data.path,
            settings: res.data.settings,
            fileTree: [],
          });
          get().refreshFileTree();
          setTimeout(() => get().refreshFileTree(), 250);
        } else {
          console.error('Failed to create new project:', res.message);
        }
      })
      .catch((error: unknown) => {
        console.error('Error creating new project:', error);
      });
  },

  openProject: () => {
    window.api
      .openProject()
      .then(res => {
        if (res.success && res.data) {
          set({
            projectName: res.data.name,
            projectPath: res.data.path,
            settings: res.data.settings,
            fileTree: [],
          });
          get().refreshFileTree();
          setTimeout(() => get().refreshFileTree(), 250);
        } else {
          console.error('Failed to open project:', res.message);
        }
      })
      .catch((error: unknown) => {
        console.error('Error opening project:', error);
      });
  },

  closeProject: () => {
    set({
      projectName: '',
      projectPath: '',
      settings: { asm: [], main: '' },
      fileTree: [],
      selectedFileOrFolder: null,
    });
  },

  getAsmAbsolutePaths: () => {
    const { projectPath, settings } = get();
    if (!projectPath) return [];
    return (settings.asm || []).map(rel => {
      const cleaned = rel.replace(/^\.?\//, '');
      return `${projectPath}/${cleaned}`;
    });
  },

  setSettings: (settings: { asm: string[]; main: string }) => set({ settings }),
}));
