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

  const {
    projectName,
    fileTree,
    refreshFileTree,
    selectedFileOrFolder,
    setSelectedFileOrFolder,
    settings,
  } = useProjectStore();
  const { openTab } = useEditorTabStore();
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
      <div className="flex items-center justify-between p-2 border-b border-gray-300">
        <span className="font-bold">{projectName}</span>
        <div className="flex gap-2">
          <button
            className="p-1 rounded hover:bg-gray-200"
            onClick={() => setNewFileDialogOpen(true)}
            title="새 파일 생성"
          >
            <FilePlus width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-200"
            onClick={() => setNewFolderDialogOpen(true)}
            title="새 폴더 생성"
          >
            <FolderPlus width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          <button className="p-1 rounded hover:bg-gray-200" onClick={refreshFileTree}>
            <RefreshCcw width={ICON_SIZE} height={ICON_SIZE} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" tabIndex={0} onKeyDown={handleKeyDown}>
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
            projectFiles={settings.asm}
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
