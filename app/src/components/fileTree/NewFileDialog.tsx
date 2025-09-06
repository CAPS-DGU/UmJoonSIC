import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useProjectStore } from '@/stores/ProjectStore';
import type { FileStructure } from '@/types/fileTree';

interface NewFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolder: string;
  onFileCreated?: () => void;
}

export function NewFileDialog({
  open,
  onOpenChange,
  currentFolder,
  onFileCreated,
}: NewFileDialogProps) {
  const [fileName, setFileName] = useState('');
  const [fileExt, setFileExt] = useState('.asm'); // 기본 확장자
  const inputRef = useRef<HTMLInputElement>(null);
  const { projectPath, addAsmFile, refreshFileTree } = useProjectStore();

  useEffect(() => {
    if (open) {
      setFileName('');
      setFileExt('.asm');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleCreate = async () => {
    const trimmed = fileName.trim();
    if (!trimmed) return;

    const relativePath = currentFolder
      ? `${currentFolder}/${trimmed}${fileExt}`
      : `${trimmed}${fileExt}`;
    const fullPath = `${projectPath}/${relativePath}`.replace(/\/+/g, '/');

    try {
      console.log('Creating file at:', fullPath);
      const res = await window.api.createNewFile(fullPath, `${trimmed}${fileExt}`);
      if (res.success) {
        const newFile: FileStructure = {
          type: 'file',
          name: `${trimmed}${fileExt}`,
          relativePath: relativePath,
        };

        if (fileExt === '.asm') addAsmFile(newFile);
        refreshFileTree();
        onFileCreated?.();
        setFileName('');
        onOpenChange(false);
      } else {
        alert(`파일 생성 실패: ${res.message}`);
      }
    } catch (err) {
      alert(`파일 생성 중 오류 발생: ${err}`);
    }
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
