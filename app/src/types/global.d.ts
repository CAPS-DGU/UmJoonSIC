interface Window {
  api: {
    getFileList: (path: string) => Promise<{ success: boolean; data?: string[]; message?: string }>;
    createNewProject: () => Promise<{
      success: boolean;
      data?: { name: string; path: string; settings: { asm: string[]; main: string } };
      message?: string;
    }>;
    readFile: (path: string) => Promise<{ success: boolean; data?: string; message?: string }>;
    saveFile: (path: string, content: string) => Promise<{ success: boolean; message?: string }>;
    openProject: () => Promise<{
      success: boolean;
      data?: { name: string; path: string; settings: { asm: string[]; main: string } };
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
    deleteFile: (
      projectPath: string,
      relativePath: string,
    ) => Promise<{ success: boolean; message?: string }>;
    deleteFolder: (
      projectPath: string,
      relativePath: string,
    ) => Promise<{ success: boolean; message?: string }>;
  };
}

declare module '*.svg' {
  const content: string;
  export default content;
}
