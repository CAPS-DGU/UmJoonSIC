import { ChevronDown, ChevronRight, File, Folder, Settings, List } from 'lucide-react';
import type { FileStructure } from '@/types/fileTree';

type StyleRule = (item: FileStructure) => string;

const makeStyleRules = (projectFiles: string[]): StyleRule[] => [
  // 프로젝트에 포함된 파일 → 파란색
  item => (projectFiles.includes(item.relativePath) ? 'text-blue-600' : ''),
  // .out 또는 linker 폴더 → 주황색
  item =>
    item.type === 'folder' && (item.name === '.out' || item.name === 'linker')
      ? 'text-orange-600'
      : '',
];

interface Props {
  item: FileStructure;
  expanded: Record<string, boolean>;
  toggleFolder: (name: string) => void;
  selected: FileStructure | null;
  onSelect: (item: FileStructure) => void;
  onOpenFile: (item: FileStructure) => void;
  onContextMenu: (e: React.MouseEvent, item: FileStructure) => void;
  projectFiles: string[];
  focusPath: string;
}

export function FileTreeItem({
  item,
  expanded,
  toggleFolder,
  selected,
  onSelect,
  onOpenFile,
  onContextMenu,
  projectFiles,
  focusPath,
}: Props) {
  if (item.type === 'folder') {
    const isOpen = expanded[item.name];
    return (
      <div>
        <div
          className={`
            flex items-center gap-2 cursor-pointer px-2 py-1 hover:bg-gray-200
            ${selected?.relativePath === item.relativePath ? 'bg-gray-100' : ''}
            ${focusPath === item.relativePath ? 'bg-blue-100' : ''}
          `}
          tabIndex={0}
          onClick={() => {
            onSelect(item);
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
          <Folder
            width={16}
            height={16}
            className={makeStyleRules(projectFiles)
              .map(rule => rule(item))
              .join(' ')}
          />
          <span
            className={`font-semibold ${makeStyleRules(projectFiles)
              .map(rule => rule(item))
              .join(' ')}`}
          >
            {item.name}
          </span>
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
                  projectFiles,
                  focusPath,
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
      className={`
        pl-7 flex items-center gap-2 px-2 py-1 hover:bg-gray-100 cursor-pointer
        ${selected?.relativePath === item.relativePath ? 'bg-gray-100' : ''}
        ${focusPath === item.relativePath ? 'bg-blue-100' : ''}
      `}
      onClick={() => {
        onSelect(item);
        onOpenFile(item); // 클릭 시 바로 열기
      }}
      onContextMenu={e => onContextMenu(e, item)}
      tabIndex={0}
    >
      {getFileIcon(item.name)}
      <span
        className={`${makeStyleRules(projectFiles)
          .map(rule => rule(item))
          .join(' ')}`}
      >
        {item.name}
      </span>
    </div>
  );
}
