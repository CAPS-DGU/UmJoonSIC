import type { MouseEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileText,
  Folder,
  ScrollText,
  Settings,
} from 'lucide-react';
import type { FileStructure } from '@/features/fileTree/types';

const ICON_SIZE = 16;

/** Folders holding build output are tinted. */
const OUTPUT_FOLDERS = ['.out', 'linker'];

/**
 * Colour of an entry: blue for files assembled by the project (its asm list), muted grey for
 * build-output folders (they were orange, which read as a warning and had poor contrast).
 */
function colorClasses(item: FileStructure, projectFiles: string[]) {
  const projectFile = projectFiles.includes(item.relativePath) ? 'text-blue-700' : '';
  const outputFolder =
    item.type === 'folder' && OUTPUT_FOLDERS.includes(item.name)
      ? 'text-gray-600 font-normal italic'
      : '';
  return [projectFile, outputFolder].join(' ');
}

/** One icon per kind of file: settings, assembly source, listing, text. */
function FileIcon({ fileName }: { fileName: string }) {
  const lower = fileName.toLowerCase();
  const Icon =
    lower === 'project.sic'
      ? Settings
      : lower.endsWith('.asm')
        ? FileCode
        : lower.endsWith('.lst')
          ? ScrollText
          : lower.endsWith('.txt')
            ? FileText
            : File;
  return <Icon width={ICON_SIZE} height={ICON_SIZE} className="shrink-0" />;
}

interface FileTreeItemProps {
  item: FileStructure;
  /** Expanded folders, by project-relative path. */
  expanded: Record<string, boolean>;
  toggleFolder: (relativePath: string) => void;
  selected: FileStructure | null;
  onSelect: (item: FileStructure) => void;
  onOpenFile: (item: FileStructure) => void;
  onContextMenu: (e: MouseEvent, item: FileStructure) => void;
  /** Project-relative paths of the files listed in project.sic. */
  projectFiles: string[];
  /** Path of the entry that has keyboard focus; marked only while the tree has the focus. */
  focusPath: string;
  showFocus: boolean;
}

/** One file or folder of the tree; a folder renders its children when expanded. */
export function FileTreeItem(props: FileTreeItemProps) {
  const { item, expanded, toggleFolder, selected, onSelect, onOpenFile, onContextMenu } = props;
  const { projectFiles, focusPath, showFocus } = props;

  const color = colorClasses(item, projectFiles);
  const stateClasses = `
            ${selected?.relativePath === item.relativePath ? 'bg-gray-200' : ''}
            ${showFocus && focusPath === item.relativePath ? 'bg-blue-100' : ''}
          `;

  if (item.type === 'folder') {
    const isOpen = expanded[item.relativePath];
    const Chevron = isOpen ? ChevronDown : ChevronRight;
    return (
      <div>
        <div
          className={`
            flex items-center gap-2 cursor-pointer px-2 py-1 text-sm hover:bg-gray-200${stateClasses}`}
          tabIndex={0}
          onClick={() => {
            onSelect(item);
            toggleFolder(item.relativePath);
          }}
          onContextMenu={e => onContextMenu(e, item)}
        >
          <Chevron width={ICON_SIZE} height={ICON_SIZE} className="shrink-0" />
          <Folder width={ICON_SIZE} height={ICON_SIZE} className={`shrink-0 ${color}`} />
          <span className={`min-w-0 truncate font-semibold ${color}`} title={item.relativePath}>
            {item.name}
          </span>
        </div>
        {isOpen && (
          <div className="ml-4">
            {item.children.map(child => (
              <FileTreeItem key={child.relativePath} {...props} item={child} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    // A file opens on a single click.
    <div
      className={`
        flex items-center gap-2 py-1 pl-8 pr-2 text-sm hover:bg-gray-100 cursor-pointer${stateClasses}`}
      onClick={() => {
        onSelect(item);
        onOpenFile(item);
      }}
      onContextMenu={e => onContextMenu(e, item)}
      tabIndex={0}
    >
      <FileIcon fileName={item.name} />
      <span className={`min-w-0 truncate ${color}`} title={item.relativePath}>
        {item.name}
      </span>
    </div>
  );
}
