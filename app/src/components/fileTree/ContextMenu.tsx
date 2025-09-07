import { useEffect, useRef, useState } from 'react';
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleDelete = () => {
    onDelete(item);
    setShowConfirm(false);
    onClose();
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed bg-white border border-gray-300 rounded shadow-lg z-50"
        style={{ left: x, top: y }}
      >
        <button
          className="flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-gray-100 text-red-600"
          onClick={() => setShowConfirm(true)}
        >
          <Trash2 width={16} height={16} />
          삭제
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-80">
            <h2 className="text-lg font-semibold mb-4">정말 삭제하시겠습니까?</h2>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                onClick={() => setShowConfirm(false)}
              >
                취소
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={handleDelete}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
