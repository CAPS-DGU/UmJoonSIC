import { useState } from 'react';
import { FilePlus, FolderPlus, RefreshCcw } from 'lucide-react';
import { useProjectStore } from '@/stores/ProjectStore';
import { useEditorTabStore } from '@/stores/EditorTabStore';
import { useFileTree, type FileStructure } from '@/hooks/useFileTree';
import { FileTreeItem } from '@/components/fileTree/FileTreeItem';
import { ContextMenu } from '@/components/fileTree/ContextMenu';

export default function SideBar() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    item: FileStructure | null;
  }>({ show: false, x: 0, y: 0, item: null });
  const { projectName, fileTree, refreshFileTree, selectedFileOrFolder, setSelectedFileOrFolder } =
    useProjectStore();
  const { tabs, addTab } = useEditorTabStore();

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

  return (
    <div className="w-60 bg-white border-r border-gray-300 flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-gray-300">
        <span className="font-bold">{projectName}</span>
        <div className="flex gap-2">
          <button className="p-1 rounded hover:bg-gray-200">
            <FilePlus width={16} height={16} />
          </button>
          <button className="p-1 rounded hover:bg-gray-200">
            <FolderPlus width={16} height={16} />
          </button>
          <button className="p-1 rounded hover:bg-gray-200" onClick={refreshFileTree}>
            <RefreshCcw width={16} height={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
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
          />
        ))}
      </div>
      {contextMenu.show && contextMenu.item && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onDelete={item => console.log('삭제', item)}
          onClose={() => setContextMenu({ show: false, x: 0, y: 0, item: null })}
        />
      )}
    </div>
  );
}
