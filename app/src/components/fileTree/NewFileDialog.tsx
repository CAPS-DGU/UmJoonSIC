import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useProjectFiles } from '@/hooks/useProjectFiles';
import type { FileStructure } from '@/types/fileTree';

interface NewFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolder: FileStructure | null;
  onFileCreated?: () => void;
}

export function NewFileDialog({
  open,
  onOpenChange,
  currentFolder,
  onFileCreated,
}: NewFileDialogProps) {
  const [fileName, setFileName] = useState('');
  const [fileExt, setFileExt] = useState('.asm');
  const inputRef = useRef<HTMLInputElement>(null);
  const { createFile } = useProjectFiles();

  useEffect(() => {
    if (open) {
      setFileName('');
      setFileExt('.asm');
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleCreate = async () => {
    createFile(currentFolder, fileName, fileExt)
      .then(newFile => {
        if (newFile && onFileCreated) onFileCreated();
        onOpenChange(false);
      })
      .catch(err => {
        alert(`파일 생성 실패: ${err.message}`);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-md shadow-lg w-96 p-6 flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>새 파일 만들기</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="파일명"
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') onOpenChange(false);
            }}
          />
          <select
            className="px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={fileExt}
            onChange={e => setFileExt(e.target.value)}
          >
            <option value=".asm">.asm</option>
            <option value=".txt">.txt</option>
          </select>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <button
            className="px-3 py-1 rounded border hover:bg-gray-100"
            onClick={() => onOpenChange(false)}
          >
            취소
          </button>
          <button
            className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
            onClick={handleCreate}
          >
            생성
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
