import { useState, useMemo, useCallback } from 'react';
import type { FileStructure } from '@/features/fileTree/types';

export function useFileTreeNavigation(
  fileTree: FileStructure[],
  expanded: Record<string, boolean>,
  toggleFolder: (relativePath: string) => void,
  onOpenFile: (item: FileStructure) => void,
) {
  const [focusIndex, setFocusIndex] = useState(0);

  const flatList = useMemo(() => {
    const flatten = (items: FileStructure[], acc: FileStructure[] = []): FileStructure[] => {
      for (const item of items) {
        acc.push(item);
        if (item.type === 'folder' && expanded[item.relativePath] && item.children) {
          flatten(item.children, acc);
        }
      }
      return acc;
    };
    return flatten(fileTree);
  }, [fileTree, expanded]);

  const focusPath = flatList[focusIndex]?.relativePath;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!flatList.length) return;
      const item = flatList[focusIndex];
      if (!item) return; // 안전 체크

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusIndex(prev => Math.min(prev + 1, flatList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'ArrowRight':
          if (item.type === 'folder' && !expanded[item.relativePath])
            toggleFolder(item.relativePath);
          break;
        case 'ArrowLeft':
          if (item.type === 'folder' && expanded[item.relativePath])
            toggleFolder(item.relativePath);
          break;
        case 'Enter':
          onOpenFile(item);
          break;
      }
    },
    [flatList, focusIndex, expanded, toggleFolder, onOpenFile],
  );

  return { focusIndex, flatList, focusPath, handleKeyDown, setFocusIndex };
}
