import { useShallow } from 'zustand/react/shallow';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import type { FileStructure } from '@/features/fileTree/types';
import { resolveUnsavedChanges } from '@/features/editor/unsavedChanges';
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

/** A file action that failed; `code` says why (IpcResult.code: 'exists', 'badName', ...). */
export class FileActionError extends Error {
  readonly code: string | undefined;
  constructor(code: string | undefined, message: string | undefined) {
    super(message ?? code ?? 'failed');
    this.code = code;
  }
}

/** Create and delete files and folders of the open project, keeping project.sic and the tree in sync. */
export function useProjectFiles() {
  const { projectPath, addAsmFile, removeAsmFiles, refreshFileTree, setSelectedFileOrFolder } =
    useProjectStore(
      useShallow(s => ({
        projectPath: s.projectPath,
        addAsmFile: s.addAsmFile,
        removeAsmFiles: s.removeAsmFiles,
        refreshFileTree: s.refreshFileTree,
        setSelectedFileOrFolder: s.setSelectedFileOrFolder,
      })),
    );

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
      throw new FileActionError(res.code, res.message);
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
      throw new FileActionError(res.code, res.message);
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
      throw new FileActionError(result.code, result.message);
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
      throw new FileActionError(res.code, res.message);
    }

    const inFolder = (p: string) => p.startsWith(`${folder.relativePath}/`);
    await removeAsmFiles(useProjectStore.getState().savedSettings.asm.filter(inFolder));
    useEditorTabStore.getState().closeTabsUnder(folder.relativePath);
    refreshFileTree();
    deselectIfSelected(folder);
  };

  /**
   * Rename a file or folder. Unsaved changes in its tabs are dealt with first; the asm list
   * follows; a renamed file that was open is opened again under its new name, in the same
   * place of the tab strip, with the same cursor, active only if it was.
   */
  const renameEntry = async (item: FileStructure, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === item.name) return;
    const under = (p: string) => p === item.relativePath || p.startsWith(`${item.relativePath}/`);
    const { tabs, activePath, closeTabsUnder, openTab } = useEditorTabStore.getState();
    const affected = tabs.filter(tab => under(tab.filePath)).map(tab => tab.filePath);
    const tabIndex = tabs.findIndex(tab => tab.filePath === item.relativePath);
    if (affected.length && !(await resolveUnsavedChanges(affected))) return;

    const res = await window.api.renamePath(projectPath, item.relativePath, trimmed);
    if (!res.success) throw new FileActionError(res.code, res.message);

    const renamedPath = joinRelative(parentOf(item.relativePath), trimmed);
    closeTabsUnder(item.relativePath);
    await useProjectStore.getState().renameAsmPaths(item.relativePath, renamedPath);
    refreshFileTree();
    if (item.type === 'file' && tabIndex >= 0) {
      await openTab({ title: trimmed, filePath: renamedPath, cursor: tabs[tabIndex].cursor });
      const store = useEditorTabStore.getState();
      store.moveTab(renamedPath, tabIndex);
      if (activePath !== item.relativePath && store.tabs.some(tab => tab.filePath === activePath)) {
        store.activateTab(activePath!);
      }
    }
    setSelectedFileOrFolder(
      item.type === 'file' ? { ...item, name: trimmed, relativePath: renamedPath } : null,
    );
  };

  return { createFile, deleteFile, createFolder, deleteFolder, renameEntry };
}
