import { describe, expect, it } from 'vitest';
import type { FileStructure } from '@/features/fileTree/types';
import { buildFileTree } from '@/features/fileTree/useFileTree';

const entry = (relativePath: string): FileStructure => ({
  type: 'file',
  name: relativePath.split('/').filter(Boolean).pop()!,
  relativePath,
});

describe('buildFileTree', () => {
  it('nests files in folders, folders first, then by name', () => {
    const tree = buildFileTree(['main.asm', 'sub/', 'sub/b.asm', 'sub/a.asm', 'a.txt'].map(entry));
    expect(tree.map(item => item.name)).toEqual(['sub', 'a.txt', 'main.asm']);
    const sub = tree[0];
    expect(sub.type).toBe('folder');
    if (sub.type === 'folder') {
      expect(sub.children.map(c => c.relativePath)).toEqual(['sub/a.asm', 'sub/b.asm']);
    }
  });

  it('keeps an empty folder', () => {
    expect(buildFileTree([entry('empty/')])).toEqual([
      { type: 'folder', name: 'empty', relativePath: 'empty', children: [] },
    ]);
  });
});
