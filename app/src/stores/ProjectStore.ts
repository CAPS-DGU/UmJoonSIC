import { create } from 'zustand';

// Window 타입 확장
declare global {
  interface Window {
    api: {
      getFileList: (path: string) => Promise<{
        success: boolean;
        data?: string[];
        message?: string;
      }>;
      createNewProject: () => Promise<{
        success: boolean;
        data?: {
          name: string;
          path: string;
          settings: {
            asm: string[];
            main: string;
          };
        };
        message?: string;
      }>;
      readFile: (filePath: string) => Promise<{
        success: boolean;
        data?: string;
        message?: string;
      }>;
      saveFile: (
        filePath: string,
        content: string,
      ) => Promise<{
        success: boolean;
        message?: string;
      }>;
    };
  }
}

interface ProjectState {
  projectName: string;
  projectPath: string;
  settings: {
    asm: string[];
    main: string;
  };
  fileTree: string[];
  refreshFileTree: () => void;
  refreshSettings: () => void;
  setProject: (project: ProjectState) => void;
  createNewProject: () => void;
}

export const useProjectStore = create<ProjectState>(set => ({
  projectName: '',
  projectPath: '',
  settings: {
    asm: [],
    main: '',
  },
  fileTree: [],
  refreshFileTree: () => {
    const currentPath = useProjectStore.getState().projectPath;

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
          // 프로젝트 생성 후 파일 트리 새로고침
          useProjectStore.getState().refreshFileTree();
        } else {
          console.error('Failed to create new project:', res.message);
        }
      })
      .catch((error: unknown) => {
        console.error('Error creating new project:', error);
      });
  },
}));
