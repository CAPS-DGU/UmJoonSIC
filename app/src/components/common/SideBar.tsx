import { useState } from 'react';
import { FilePlus, FolderPlus, RefreshCcw } from 'lucide-react';
import { useProjectStore } from '@/stores/ProjectStore';
import { useEditorTabStore } from '@/stores/EditorTabStore';

import { useFileTree } from '@/hooks/useFileTree';
import { useProjectFiles } from '@/hooks/useProjectFiles';
import type { FileStructure } from '@/types/fileTree';
import { useFileTreeNavigation } from '@/hooks/useFileTreeNavigation';

import { FileTreeItem } from '@/components/fileTree/FileTreeItem';
import { ContextMenu } from '@/components/fileTree/ContextMenu';
import { NewFileDialog } from '@/components/fileTree/NewFileDialog';
import { NewFolderDialog } from '@/components/fileTree/NewFolderDialog';

export default function SideBar() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    item: FileStructure | null;
  }>({ show: false, x: 0, y: 0, item: null });
  const {
    projectName,
    fileTree,
    refreshFileTree,
    selectedFileOrFolder,
    setSelectedFileOrFolder,
    settings,
  } = useProjectStore();
  const { tabs, addTab } = useEditorTabStore();
  const { deleteFile, deleteFolder } = useProjectFiles();

  const fileTreeStructure = useFileTree(fileTree);

  const toggleFolder = (name: string) => setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  const handleOpenFile = (item: FileStructure) => {
    if (item.type === 'file') {
      addTab({
        idx: tabs.length,
        title: item.name,
        filePath: item.relativePath,
        isModified: false,
        fileContent: '',
        isActive: true,
        cursor: { line: 0, column: 0 },
        breakpoints: [],
      });
    }
  };

  const { focusPath, handleKeyDown } = useFileTreeNavigation(
    fileTreeStructure,
    expanded,
    toggleFolder,
    handleOpenFile,
  );

  return (
    <div className="w-full bg-white border-r border-gray-300 flex flex-col h-screen">
      <div className="flex items-center justify-between p-2 border-b border-gray-300">
        <span className="font-bold">{projectName}</span>
        <div className="flex gap-2">
          <button
            className="p-1 rounded hover:bg-gray-200"
            onClick={() => setNewFileDialogOpen(true)}
            title="새 파일 생성"
          >
            <FilePlus width={16} height={16} />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-200"
            onClick={() => setNewFolderDialogOpen(true)}
            title="새 폴더 생성"
          >
            <FolderPlus width={16} height={16} />
          </button>
          <button className="p-1 rounded hover:bg-gray-200" onClick={refreshFileTree}>
            <RefreshCcw width={16} height={16} />
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
            onContextMenu={(e, item) =>
              setContextMenu({ show: true, x: e.clientX, y: e.clientY, item })
            }
            projectFiles={settings.asm}
            focusPath={focusPath}
          />
        ))}
      </div>
      {contextMenu.show && contextMenu.item && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onDelete={item => {
            if (item.type === 'file') {
              deleteFile(item).then(() => {});
            } else if (item.type === 'folder') {
              deleteFolder(item).then(() => {});
            }
          }}
          onClose={() => setContextMenu({ show: false, x: 0, y: 0, item: null })}
        />
      )}

      {/* 새 파일 다이얼로그 연결 */}
      <NewFileDialog
        open={newFileDialogOpen}
        onOpenChange={setNewFileDialogOpen}
        currentFolder={selectedFileOrFolder}
        onFileCreated={() => {
          refreshFileTree(); // 생성 후 파일 트리 갱신
        }}
      />
      {/* 새 폴더 다이얼로그 연결 */}
      <NewFolderDialog
        open={newFolderDialogOpen}
        onOpenChange={setNewFolderDialogOpen}
        currentFolder={selectedFileOrFolder}
        onFolderCreated={() => {
          refreshFileTree(); // 생성 후 파일 트리 갱신
        }}
      />
    </div>
  );
}
