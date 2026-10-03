import { useEditorTabStore } from '@/features/editor/editorTabStore';
import type { FileStructure } from '@/features/fileTree/types';
import { useProjectStore } from '@/features/project/projectStore';

/** 'a/b/c' -> 'a/b'; a top-level entry -> ''. */
const parentOf = (relativePath: string) => relativePath.split('/').slice(0, -1).join('/');

/** The folder a new entry goes into: the selected folder, or the selected file's folder. */
const targetFolder = (selected: FileStructure | null) =>
  !selected
    ? ''
    : selected.type === 'folder'
      ? selected.relativePath
      : parentOf(selected.relativePath);

const joinRelative = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

/** Create and delete files and folders of the open project, keeping project.sic and the tree in sync. */
export function useProjectFiles() {
  const { projectPath, addAsmFile, removeAsmFiles, refreshFileTree, setSelectedFileOrFolder } =
    useProjectStore();

  const absolute = (relativePath: string) => `${projectPath}/${relativePath}`.replace(/\/+/g, '/');

  const deselectIfSelected = (item: FileStructure) => {
    const selected = useProjectStore.getState().selectedFileOrFolder;
    if (selected?.relativePath === item.relativePath) {
      setSelectedFileOrFolder(null);
    }
  };

  /**
   * Create an empty file in the selected folder (or next to the selected file, or at the
   * project root). A new .asm file is also added to the project's asm list.
   */
  const createFile = async (folder: FileStructure | null, fileName: string, fileExt: string) => {
    const trimmed = fileName.trim();
    if (!trimmed) return;

    const folderPath = targetFolder(folder);
    const relativePath = joinRelative(folderPath, `${trimmed}${fileExt}`);

    const res = await window.api.createNewFile(absolute(folderPath), `${trimmed}${fileExt}`);
    if (!res.success) {
      throw new Error(res.message);
    }

    const newFile: FileStructure = { type: 'file', name: `${trimmed}${fileExt}`, relativePath };
    if (fileExt === '.asm') await addAsmFile(newFile);
    refreshFileTree();
    return newFile;
  };

  const deleteFile = async (file: FileStructure) => {
    const folderFullPath = parentOf(`${projectPath}/${file.relativePath}`);
    const res = await window.api.deleteFile(folderFullPath, file.name);
    if (!res.success) {
      throw new Error(res.message);
    }

    await removeAsmFiles([file.relativePath]);
    useEditorTabStore.getState().closeTabsUnder(file.relativePath);
    refreshFileTree();
    deselectIfSelected(file);
  };

  /** Create a folder in the selected folder (or next to the selected file, or at the root). */
  const createFolder = async (folder: FileStructure | null, folderName: string) => {
    const trimmed = folderName.trim();
    if (!trimmed) return;

    const parentRelativePath = targetFolder(folder);
    const result = await window.api.createNewFolder(absolute(parentRelativePath), trimmed);
    if (!result.success) {
      throw new Error(result.message ?? '폴더 생성 실패');
    }

    refreshFileTree();
    setSelectedFileOrFolder({
      type: 'folder',
      name: trimmed,
      relativePath: joinRelative(parentRelativePath, trimmed),
      children: [],
    });
  };

  /** Delete a folder with everything in it; its files leave the asm list and their tabs close. */
  const deleteFolder = async (folder: FileStructure) => {
    const res = await window.api.deleteFolder(absolute(parentOf(folder.relativePath)), folder.name);
    if (!res.success) {
      throw new Error(res.message);
    }

    const inFolder = (p: string) => p.startsWith(`${folder.relativePath}/`);
    await removeAsmFiles(useProjectStore.getState().savedSettings.asm.filter(inFolder));
    useEditorTabStore.getState().closeTabsUnder(folder.relativePath);
    refreshFileTree();
    deselectIfSelected(folder);
  };

  return { createFile, deleteFile, createFolder, deleteFolder };
}
