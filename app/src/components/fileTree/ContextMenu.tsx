import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { FileStructure } from '@/types/fileTree';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

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

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  const handleDelete = () => {
    console.log('Deleting item:', item);
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

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="!max-w-sm min-h-[150px]">
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
          </AlertDialogHeader>
          <p>{item.name}을 삭제합니다.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
