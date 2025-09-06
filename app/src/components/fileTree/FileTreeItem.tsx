import { ChevronDown, ChevronRight, File, Folder, Settings, List } from 'lucide-react';
import type { FileStructure } from '@/hooks/useFileTree';

interface Props {
  item: FileStructure;
  expanded: Record<string, boolean>;
  toggleFolder: (name: string) => void;
  selected: string;
  onSelect: (path: string) => void;
  onOpenFile: (item: FileStructure) => void;
  onContextMenu: (e: React.MouseEvent, item: FileStructure) => void;
}

export function FileTreeItem({
  item,
  expanded,
  toggleFolder,
  selected,
  onSelect,
  onOpenFile,
  onContextMenu,
}: Props) {
  if (item.type === 'folder') {
    const isOpen = expanded[item.name];
    return (
      <div>
        <div
          className={`flex items-center gap-2 cursor-pointer px-2 py-1 hover:bg-gray-200 ${selected === item.relativePath + '/' ? 'bg-gray-100' : ''}`}
          onClick={() => {
            onSelect(item.relativePath + '/');
            toggleFolder(item.name);
          }}
          onContextMenu={e => onContextMenu(e, item)}
        >
          <span className="text-xs w-3">
            {isOpen ? (
              <ChevronDown width={16} height={16} />
            ) : (
              <ChevronRight width={16} height={16} />
            )}
          </span>
          <Folder width={16} height={16} />
          <span>{item.name}</span>
        </div>
        {isOpen && (
          <div className="ml-6">
            {item.children.map(child => (
              <FileTreeItem
                key={child.relativePath}
                {...{
                  item: child,
                  expanded,
                  toggleFolder,
                  selected,
                  onSelect,
                  onOpenFile,
                  onContextMenu,
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const getFileIcon = (fileName: string) => {
    if (fileName.toLowerCase() === 'project.sic') return <Settings width={16} height={16} />;
    if (fileName.toLowerCase().endsWith('.lst')) return <List width={16} height={16} />;
    return <File width={16} height={16} />;
  };

  return (
    <div
      className={`ml-5 flex items-center gap-2 px-2 py-1 hover:bg-gray-100 cursor-pointer ${selected === item.relativePath ? 'bg-gray-100' : ''}`}
      onClick={() => {
        onSelect(item.relativePath);
        onOpenFile(item); // 클릭 시 바로 열기
      }}
      onContextMenu={e => onContextMenu(e, item)}
    >
      {getFileIcon(item.name)}
      <span>{item.name}</span>
    </div>
  );
}
