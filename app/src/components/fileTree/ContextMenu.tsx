import { Trash2 } from 'lucide-react';
import type { FileStructure } from '@/types/fileTree';

interface Props {
  x: number;
  y: number;
  item: FileStructure;
  onDelete: (item: FileStructure) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, item, onDelete, onClose }: Props) {
  return (
    <div
      className="fixed bg-white border border-gray-300 rounded shadow-lg z-50"
      style={{ left: x, top: y }}
      onClick={onClose}
    >
      <button
        className="flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-gray-100 text-red-600"
        onClick={() => onDelete(item)}
      >
        <Trash2 width={16} height={16} />
        삭제
      </button>
    </div>
  );
}
