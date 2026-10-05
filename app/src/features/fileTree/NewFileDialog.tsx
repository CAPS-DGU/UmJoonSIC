import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useProjectFiles } from '@/features/project/useProjectFiles';
import type { FileStructure } from '@/features/fileTree/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>새 파일 만들기</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            className="flex-1"
            placeholder="파일명"
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <select
            className="border-input h-9 shrink-0 rounded-md border bg-transparent px-2 text-sm shadow-xs"
            value={fileExt}
            onChange={e => setFileExt(e.target.value)}
          >
            <option value=".asm">.asm</option>
            <option value=".txt">.txt</option>
          </select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleCreate}>생성</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
