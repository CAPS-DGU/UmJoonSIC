import {
  ArrowDown,
  ArrowUp,
  FilePlus,
  FileMinus,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  ListPlus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { FileStructure } from '@/features/fileTree/types';
import { useStrings } from '@/i18n';
import { ProjectIcon } from '@/lib/icons';

interface Props {
  x: number;
  y: number;
  item: FileStructure;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  /** The project node only: open the project settings; open another project. */
  onOpenSettings: () => void;
  onOpenProject: () => void;
  /** An .asm file: whether it is assembled, and where in the order (null for other files). */
  asm: { listed: boolean; first: boolean; last: boolean } | null;
  onAsmEarlier: () => void;
  onAsmLater: () => void;
  onAsmToggle: () => void;
  onReveal: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function Item({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm disabled:pointer-events-none disabled:opacity-40 ${
        danger ? 'text-red-700 hover:bg-red-50' : 'text-gray-900 hover:bg-gray-100'
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

/** Right-click menu of the file tree: new file or folder, rename, show in the file manager, delete. */
export function ContextMenu({
  x,
  y,
  item,
  onNewFile,
  onNewFolder,
  onRename,
  onOpenSettings,
  onOpenProject,
  asm,
  onAsmEarlier,
  onAsmLater,
  onAsmToggle,
  onReveal,
  onDelete,
  onClose,
}: Props) {
  const t = useStrings();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  // Keep the menu inside the window.
  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - 320);
  const act = (action: () => void) => () => {
    onClose();
    action();
  };
  // The project node: settings instead of rename and delete.
  const isProjectFile = item.relativePath === '';

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 flex w-52 flex-col rounded-md border border-gray-300 bg-white p-1 shadow-lg"
      style={{ left, top }}
    >
      <Item
        icon={<FilePlus className="size-4" />}
        label={t.files.newFileTitle}
        onClick={act(onNewFile)}
      />
      <Item
        icon={<FolderPlus className="size-4" />}
        label={t.files.newFolderTitle}
        onClick={act(onNewFolder)}
      />
      <div className="my-1 h-px bg-gray-200" role="separator" />
      {isProjectFile && (
        <Item
          icon={<ProjectIcon className="size-4" />}
          label={t.settings.title}
          onClick={act(onOpenSettings)}
        />
      )}
      {asm && (
        <>
          {asm.listed && (
            <>
              <Item
                icon={<ArrowUp className="size-4" />}
                label={t.settings.moveUp}
                onClick={act(onAsmEarlier)}
                disabled={asm.first}
              />
              <Item
                icon={<ArrowDown className="size-4" />}
                label={t.settings.moveDown}
                onClick={act(onAsmLater)}
                disabled={asm.last}
              />
            </>
          )}
          <Item
            icon={asm.listed ? <FileMinus className="size-4" /> : <ListPlus className="size-4" />}
            label={asm.listed ? t.files.removeFromAsm : t.files.addToAsm}
            onClick={act(onAsmToggle)}
          />
          <div className="my-1 h-px bg-gray-200" role="separator" />
        </>
      )}
      {!isProjectFile && (
        <Item
          icon={<Pencil className="size-4" />}
          label={t.common.rename}
          onClick={act(onRename)}
        />
      )}
      <Item
        icon={<FolderSearch className="size-4" />}
        label={t.files.reveal}
        onClick={act(onReveal)}
      />
      {isProjectFile && (
        <Item
          icon={<FolderOpen className="size-4" />}
          label={t.files.openProject}
          onClick={act(onOpenProject)}
        />
      )}
      {!isProjectFile && (
        <>
          <div className="my-1 h-px bg-gray-200" role="separator" />
          <Item
            icon={<Trash2 className="size-4" />}
            label={t.common.delete}
            onClick={act(onDelete)}
            danger
          />
        </>
      )}
    </div>
  );
}
