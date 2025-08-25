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
      createNewFile: (
        folderPath: string,
        fileName: string,
      ) => Promise<{ success: boolean; message?: string }>;
      createNewFolder: (
        folderPath: string,
        folderName: string,
      ) => Promise<{ success: boolean; message?: string }>;
    };
  }
}

interface ProjectState {
  projectName: string;
  projectPath: string;
  settings: { asm: string[]; main: string };
  fileTree: string[];
  selectedFileOrFolder: string;
  setSelectedFileOrFolder: (path: string) => void;
  getFolderFromSelectedFileOrFolder: () => string;
  refreshFileTree: () => void;
  refreshSettings: () => void;
  setProject: (project: ProjectState) => void;
  createNewProject: () => void;
  openProject: () => void;
  closeProject: () => void;
  getAsmAbsolutePaths: () => string[];
  addAsmFile: (filePath: string) => void;
  saveSettings: () => Promise<{ success: boolean, message?: string }>;
  setSettings: (settings: { asm: string[]; main: string }) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectName: '',
  projectPath: '',
  settings: { asm: [], main: '' },
  fileTree: [],
  selectedFileOrFolder: '',
  setSelectedFileOrFolder: (path: string) => set({ selectedFileOrFolder: path }),
  getFolderFromSelectedFileOrFolder: () => {
    const { selectedFileOrFolder } = get();

    // 빈 문자열이거나 루트 경로인 경우
    if (!selectedFileOrFolder || selectedFileOrFolder === '/') {
      return selectedFileOrFolder;
    }

    // /로 끝나는 경우 (디렉터리) - 그대로 반환
    if (selectedFileOrFolder.endsWith('/')) {
      return selectedFileOrFolder;
    }

    // 파일인 경우 - 파일명을 제거하고 디렉터리만 반환
    const pathParts = selectedFileOrFolder.split('/');
    pathParts.pop(); // 마지막 부분(파일명) 제거

    // 루트 디렉터리인 경우
    if (pathParts.length === 0 || (pathParts.length === 1 && pathParts[0] === '')) {
      return '/';
    }

    return pathParts.join('/');
  },
  addAsmFile: (filePath: string) => {
    const { settings, fileTree, saveSettings } = get();
    set({
      settings: { ...settings, asm: [...settings.asm, filePath] },
      fileTree: [...fileTree, filePath],
    });
    saveSettings();
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

  closeProject: () => {
    set({
      projectName: '',
      projectPath: '',
      settings: { asm: [], main: '' },
      fileTree: [],
      selectedFileOrFolder: '',
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
