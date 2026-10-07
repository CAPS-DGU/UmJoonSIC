import type { MouseEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileText,
  Folder,
  ScrollText,
} from 'lucide-react';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import type { FileStructure } from '@/features/fileTree/types';
import { useStrings } from '@/i18n';
import { ProjectIcon } from '@/lib/icons';

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
      ? ProjectIcon
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
  /** The project folder's full path (the root node's tooltip). */
  projectPath: string;
  /** The main program's file (project.sic's main), if it is assembled. */
  mainFile: string | null;
}

/** The path of the project node, the tree's root: the project folder itself. */
export const ROOT_PATH = '';

/**
 * "1st", "2nd" …: the place of an assembled file in the project's order (project.sic); the
 * main program's badge is filled.
 */
function OrderBadge({ index, isMain }: { index: number; isMain: boolean }) {
  const t = useStrings();
  const ordinal = t.files.ordinal(index + 1);
  return (
    <span
      className={`ml-auto shrink-0 rounded-full px-1.5 text-[11px] font-semibold leading-4 tabular-nums ${
        isMain ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'
      }`}
      title={isMain ? t.files.mainOrderTitle(ordinal) : t.files.orderTitle(ordinal)}
      data-assembly-order={index + 1}
    >
      {ordinal}
    </span>
  );
}

/**
 * The project node: the project folder, like a solution in Visual Studio's Solution Explorer.
 * project.sic is not listed as a file; this node opens the project settings, which edit it.
 */
function ProjectRoot(
  props: FileTreeItemProps & { item: Extract<FileStructure, { type: 'folder' }> },
) {
  const t = useStrings();
  const mode = useMemoryViewStore(s => s.mode);
  const { item, selected, onSelect, onOpenFile, onContextMenu } = props;
  const { focusPath, showFocus, projectPath } = props;
  // It does not fold: one click opens the settings, and only that (a node that both folds
  // and opens on one click drew complaints in Visual Studio).
  return (
    <div>
      <div
        role="treeitem"
        data-project-root
        className={`flex h-8 items-center gap-2 cursor-pointer border-b border-gray-200 px-2 text-sm hover:bg-gray-200
          ${selected?.relativePath === ROOT_PATH ? 'bg-gray-200' : ''}
          ${showFocus && focusPath === ROOT_PATH ? 'bg-blue-100' : ''}`}
        tabIndex={0}
        title={t.files.rootTitle(projectPath)}
        onClick={() => {
          onSelect(item);
          onOpenFile(item);
        }}
        onContextMenu={e => onContextMenu(e, item)}
      >
        <ProjectIcon width={ICON_SIZE} height={ICON_SIZE} className="shrink-0 text-blue-700" />
        <span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span>
        <span className="shrink-0 rounded border border-gray-300 px-1 text-[11px] font-medium leading-4 text-gray-700">
          {mode === 'SICXE' ? t.run.sicxe : t.run.sic}
        </span>
      </div>
      {item.children.map(child => (
        <FileTreeItem key={child.relativePath} {...props} item={child} />
      ))}
    </div>
  );
}

/** One file or folder of the tree; a folder renders its children when expanded. */
export function FileTreeItem(props: FileTreeItemProps) {
  const { item, expanded, toggleFolder, selected, onSelect, onOpenFile, onContextMenu } = props;
  const { projectFiles, focusPath, showFocus } = props;

  if (item.relativePath === ROOT_PATH && item.type === 'folder') {
    return <ProjectRoot {...props} item={item} />;
  }

  const color = colorClasses(item, projectFiles);
  const order = item.type === 'file' ? projectFiles.indexOf(item.relativePath) : -1;
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
      {order >= 0 && <OrderBadge index={order} isMain={item.relativePath === props.mainFile} />}
    </div>
  );
}
