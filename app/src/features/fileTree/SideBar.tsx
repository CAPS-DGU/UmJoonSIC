import { useState } from 'react';
import { FilePlus, FolderPlus, RefreshCcw } from 'lucide-react';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { ContextMenu } from '@/features/fileTree/ContextMenu';
import { FileTreeItem } from '@/features/fileTree/FileTreeItem';
import { NewFileDialog } from '@/features/fileTree/NewFileDialog';
import { NewFolderDialog } from '@/features/fileTree/NewFolderDialog';
import type { FileStructure } from '@/features/fileTree/types';
import { useFileTree } from '@/features/fileTree/useFileTree';
import { useFileTreeNavigation } from '@/features/fileTree/useFileTreeNavigation';
import { BAR_ICON_BUTTON } from '@/lib/controls';
import { useProjectStore } from '@/features/project/projectStore';
import { useProjectFiles } from '@/features/project/useProjectFiles';

interface ContextMenuState {
  x: number;
  y: number;
  item: FileStructure;
}

const ICON_SIZE = 16;

/** Left column: project name, file actions and the file tree. */
export default function SideBar() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const projectName = useProjectStore(s => s.projectName);
  const fileTree = useProjectStore(s => s.fileTree);
  const refreshFileTree = useProjectStore(s => s.refreshFileTree);
  const selectedFileOrFolder = useProjectStore(s => s.selectedFileOrFolder);
  const setSelectedFileOrFolder = useProjectStore(s => s.setSelectedFileOrFolder);
  const projectFiles = useProjectStore(s => s.settings.asm);
  const openTab = useEditorTabStore(s => s.openTab);
  const { deleteFile, deleteFolder } = useProjectFiles();

  const fileTreeStructure = useFileTree(fileTree);

  const toggleFolder = (relativePath: string) =>
    setExpanded(prev => ({ ...prev, [relativePath]: !prev[relativePath] }));

  const handleOpenFile = (item: FileStructure) => {
    if (item.type === 'file') {
      openTab({ title: item.name, filePath: item.relativePath });
    }
  };

  const handleDelete = (item: FileStructure) => {
    if (item.type === 'file') {
      deleteFile(item);
    } else if (item.type === 'folder') {
      deleteFolder(item);
    }
  };

  const { focusPath, handleKeyDown } = useFileTreeNavigation(
    fileTreeStructure,
    expanded,
    toggleFolder,
    handleOpenFile,
  );

  return (
    <div className="w-full bg-white border-r border-gray-300 flex flex-col h-full">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-gray-300 px-2">
        <span className="min-w-0 truncate text-sm font-semibold" title={projectName}>
          {projectName}
        </span>
        <div className="flex shrink-0 gap-1">
          <button
            className={BAR_ICON_BUTTON}
            onClick={() => setNewFileDialogOpen(true)}
            title="새 파일 생성"
          >
            <FilePlus width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          <button
            className={BAR_ICON_BUTTON}
            onClick={() => setNewFolderDialogOpen(true)}
            title="새 폴더 생성"
          >
            <FolderPlus width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          <button className={BAR_ICON_BUTTON} onClick={refreshFileTree} title="새로 고침">
            <RefreshCcw width={ICON_SIZE} height={ICON_SIZE} />
          </button>
        </div>
      </div>

      <div
        className="slim-scroll flex-1 overflow-y-auto overflow-x-hidden"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {fileTreeStructure.map(item => (
          <FileTreeItem
            key={item.relativePath}
            item={item}
            expanded={expanded}
            toggleFolder={toggleFolder}
            selected={selectedFileOrFolder}
            onSelect={setSelectedFileOrFolder}
            onOpenFile={handleOpenFile}
            onContextMenu={(e, item) => setContextMenu({ x: e.clientX, y: e.clientY, item })}
            projectFiles={projectFiles}
            focusPath={focusPath}
          />
        ))}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      )}

      <NewFileDialog
        open={newFileDialogOpen}
        onOpenChange={setNewFileDialogOpen}
        currentFolder={selectedFileOrFolder}
        onFileCreated={refreshFileTree}
      />
      <NewFolderDialog
        open={newFolderDialogOpen}
        onOpenChange={setNewFolderDialogOpen}
        currentFolder={selectedFileOrFolder}
        onFolderCreated={refreshFileTree}
      />
    </div>
  );
}
