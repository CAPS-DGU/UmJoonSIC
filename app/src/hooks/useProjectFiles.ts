import { useProjectStore } from '@/stores/ProjectStore';
import type { FileStructure } from '@/types/fileTree';

export function useProjectFiles() {
  const { projectPath, addAsmFile, removeAsmFile, refreshFileTree, setSelectedFileOrFolder } =
    useProjectStore();

  const createFile = async (folder: FileStructure | null, fileName: string, fileExt: string) => {
    const trimmed = fileName.trim();
    if (!trimmed) return;

    // folder가 폴더면 그대로, 파일이면 마지막 부분 제거해서 부모 폴더 얻기
    const folderPath = folder
      ? folder.type === 'folder'
        ? folder.relativePath // 폴더면 그대로
        : folder.relativePath.split('/').slice(0, -1).join('/') // 파일이면 마지막 하나 제거
      : '';
    // 상대 경로 = 폴더 경로 + 새 파일명
    const relativePath = folderPath ? `${folderPath}/${trimmed}${fileExt}` : `${trimmed}${fileExt}`;

    // 폴더 절대 경로 (네이티브 API에서 folder + filename 분리 호출할 때 사용)
    const folderFullPath = `${projectPath}/${folderPath}`.replace(/\/+/g, '/');
    const res = await window.api.createNewFile(folderFullPath, `${trimmed}${fileExt}`);
    if (res.success) {
      const newFile: FileStructure = {
        type: 'file',
        name: `${fileName}${fileExt}`,
        relativePath,
      };
      if (fileExt === '.asm') addAsmFile(newFile);
      refreshFileTree();
      return newFile;
    } else {
      throw new Error(res.message);
    }
  };

  const deleteFile = async (file: FileStructure) => {
    const fullPath = `${projectPath}/${file.relativePath}`.split('/').slice(0, -1).join('/');
    const res = await window.api.deleteFile(fullPath, file.name);
    console.log('Deleting file at:', fullPath);
    console.log('Delete file result:', res);
    if (res.success) {
      if (file.type === 'file' && file.name.endsWith('.asm')) removeAsmFile(file.relativePath);
      refreshFileTree();
      const currentSelected = useProjectStore.getState().selectedFileOrFolder;
      if (currentSelected?.relativePath === file.relativePath) {
        setSelectedFileOrFolder(null);
      }
    } else {
      throw new Error(res.message);
    }
  };

  return { createFile, deleteFile };
}
