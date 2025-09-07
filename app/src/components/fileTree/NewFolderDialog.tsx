import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { FileStructure } from '@/types/fileTree';
import { useProjectFiles } from '@/hooks/useProjectFiles';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolder: FileStructure | null;
  onFolderCreated: () => void;
}

export function NewFolderDialog({ open, onOpenChange, currentFolder, onFolderCreated }: Props) {
  const [folderName, setFolderName] = useState('');
  const { createFolder } = useProjectFiles();
  const handleCreateFolder = async () => {
    createFolder(currentFolder, folderName)
      .then(() => {
        onFolderCreated();
        onOpenChange(false);
      })
      .catch(err => {
        alert(`폴더 생성 실패: ${err.message}`);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 폴더 만들기</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="폴더 이름 입력"
          value={folderName}
          onChange={e => setFolderName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCreateFolder();
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleCreateFolder}>생성</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
