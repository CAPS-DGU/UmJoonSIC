// src/stores/ProjectStore.ts
import { create } from 'zustand';

declare global {
  interface Window {
    api: {
      getFileList: (
        path: string,
      ) => Promise<{ success: boolean; data?: string[]; message?: string }>;
      createNewProject: () => Promise<{
        success: boolean;
        data?: { name: string; path: string; settings: { asm: string[]; main: string } };
        message?: string;
      }>;
      openProject: () => Promise<{
        success: boolean;
        data?: { name: string; path: string; settings: { asm: string[]; main: string } };
        message?: string;
      }>;
      readFile: (
        filePath: string,
      ) => Promise<{ success: boolean; data?: string; message?: string }>;
      saveFile: (
        filePath: string,
        content: string,
      ) => Promise<{ success: boolean; message?: string }>;
      loadAsm: (
        port: number,
        filePath: string,
      ) => Promise<{
        success: boolean;
        status?: number;
        data?: any;
        message?: string;
      }>;
    };
  }
}

interface ProjectState {
  projectName: string;
  projectPath: string;
  settings: { asm: string[]; main: string };
  fileTree: string[];
  refreshFileTree: () => void;
  refreshSettings: () => void;
  setProject: (project: ProjectState) => void;
  createNewProject: () => void;
  openProject: () => void;
  getAsmAbsolutePaths: () => string[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectName: '',
  projectPath: '',
  settings: { asm: [], main: '' },
  fileTree: [],

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
          set({ fileTree: res.data });
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

  getAsmAbsolutePaths: () => {
    const { projectPath, settings } = get();
    if (!projectPath) return [];
    return (settings.asm || []).map(rel => {
      const cleaned = rel.replace(/^\.?\//, '');
      return `${projectPath}/${cleaned}`;
    });
  },
}));
