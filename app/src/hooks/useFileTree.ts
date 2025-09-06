import { useMemo } from 'react';
import type { FileStructure } from '@/types/fileTree';

type IntermediateFileNode = { __type: 'file' };
type IntermediateFolderNode = { __type: 'folder'; __children: Record<string, IntermediateNode> };
type IntermediateNode = IntermediateFileNode | IntermediateFolderNode;

function normalizePath(path: string) {
  return path.replace(/\\/g, '/'); // 윈도우 경로 → POSIX 스타일
}

function convertToFileStructure(fileTree: FileStructure[]): FileStructure[] {
  const root: Record<string, IntermediateNode> = {};

  fileTree.forEach(file => {
    const path = normalizePath(file.relativePath);
    const isFolder = path.endsWith('/');
    const parts = path.split('/').filter(Boolean);

    let current: Record<string, IntermediateNode> = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        if (isFolder) {
          if (!current[part]) current[part] = { __type: 'folder', __children: {} };
        } else {
          if (!current[part]) current[part] = { __type: 'file' };
        }
      } else {
        if (!current[part]) current[part] = { __type: 'folder', __children: {} };
        current = (current[part] as IntermediateFolderNode).__children;
      }
    }
  });

  function toFileStructure(
    obj: Record<string, IntermediateNode>,
    parentPath = '',
  ): FileStructure[] {
    return Object.entries(obj)
      .map(([name, value]): FileStructure => {
        const currentPath = parentPath ? `${parentPath}/${name}` : name;
        if (value.__type === 'folder') {
          return {
            type: 'folder',
            name,
            children: toFileStructure(value.__children, currentPath),
            relativePath: currentPath,
          };
        }
        return { type: 'file', name, relativePath: currentPath };
      })
      .sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
  }

  return toFileStructure(root);
}

export function useFileTree(fileTree: FileStructure[]) {
  return useMemo(() => convertToFileStructure(fileTree), [fileTree]);
}
