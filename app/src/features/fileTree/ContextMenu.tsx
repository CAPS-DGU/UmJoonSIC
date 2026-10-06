import { FilePlus, FolderOpen, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { FileStructure } from '@/features/fileTree/types';
import { useStrings } from '@/i18n';

interface Props {
  x: number;
  y: number;
  item: FileStructure;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onReveal: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function Item({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-900 hover:bg-gray-100'
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
  const top = Math.min(y, window.innerHeight - 200);
  const act = (action: () => void) => () => {
    onClose();
    action();
  };
  const isProjectFile = item.relativePath === 'project.sic';

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
      {!isProjectFile && (
        <Item
          icon={<Pencil className="size-4" />}
          label={t.common.rename}
          onClick={act(onRename)}
        />
      )}
      <Item
        icon={<FolderOpen className="size-4" />}
        label={t.files.reveal}
        onClick={act(onReveal)}
      />
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
