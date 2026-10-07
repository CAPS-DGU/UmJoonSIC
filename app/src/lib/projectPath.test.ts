import { describe, expect, it } from 'vitest';
import {
  folderOf,
  isAbsolutePath,
  isForeignPath,
  resolveInProject,
  toProjectRelativePath,
} from '@/lib/projectPath';

describe('toProjectRelativePath', () => {
  it('cuts the project folder off', () => {
    expect(toProjectRelativePath('/home/u/proj', '/home/u/proj/sub/main.asm')).toBe('sub/main.asm');
  });

  it('uses / on Windows paths', () => {
    expect(toProjectRelativePath('C:\\proj', 'C:\\proj\\sub\\main.asm')).toBe('sub/main.asm');
  });

  it('returns a path outside the project as it is', () => {
    expect(toProjectRelativePath('/home/u/proj', '/tmp/x.asm')).toBe('/tmp/x.asm');
    // a folder whose name only starts like the project's
    expect(toProjectRelativePath('/home/u/proj', '/home/u/proj2/x.asm')).toBe(
      '/home/u/proj2/x.asm',
    );
  });
});

describe('isAbsolutePath', () => {
  it('knows POSIX and Windows paths', () => {
    expect(isAbsolutePath('/home/u/in.txt')).toBe(true);
    expect(isAbsolutePath('C:\\Users\\me\\in.txt')).toBe(true);
    expect(isAbsolutePath('c:/Users/me/in.txt')).toBe(true);
    expect(isAbsolutePath('\\\\server\\share\\in.txt')).toBe(true);
    expect(isAbsolutePath('in.txt')).toBe(false);
    expect(isAbsolutePath('data/in.txt')).toBe(false);
    expect(isAbsolutePath('data\\in.txt')).toBe(false);
  });
});

describe('resolveInProject', () => {
  it('puts a relative path in the project folder', () => {
    expect(resolveInProject('/home/u/HW1', 'out.txt')).toBe('/home/u/HW1/out.txt');
    expect(resolveInProject('/home/u/HW1/', './data/in.txt')).toBe('/home/u/HW1/data/in.txt');
    expect(resolveInProject('C:\\Users\\me\\HW1', 'data/in.txt')).toBe(
      'C:\\Users\\me\\HW1\\data\\in.txt',
    );
  });

  it('keeps an absolute path, also a Windows one', () => {
    expect(resolveInProject('C:\\Users\\me\\HW1', 'D:\\data\\in.txt')).toBe('D:\\data\\in.txt');
    expect(resolveInProject('/home/u/HW1', 'C:\\Users\\kim\\out.txt')).toBe(
      'C:\\Users\\kim\\out.txt',
    );
  });
});

describe('isForeignPath', () => {
  it('finds a Windows path in a project on Linux or macOS, and the reverse', () => {
    expect(isForeignPath('/home/u/HW1', 'C:\\Users\\kim\\out.txt')).toBe(true);
    expect(isForeignPath('/home/u/HW1', '/home/u/HW1/out.txt')).toBe(false);
    expect(isForeignPath('C:\\Users\\me\\HW1', '/Users/kim/out.txt')).toBe(true);
    expect(isForeignPath('C:\\Users\\me\\HW1', 'D:\\out.txt')).toBe(false);
  });
});

describe('folderOf', () => {
  it('cuts the last name off, with either separator', () => {
    expect(folderOf('/home/u/HW1/out.txt')).toBe('/home/u/HW1');
    expect(folderOf('C:\\Users\\kim\\out.txt')).toBe('C:\\Users\\kim');
    expect(folderOf('C:\\out.txt')).toBe('C:\\');
    expect(folderOf('/out.txt')).toBe('/');
    expect(folderOf('out.txt')).toBe('');
  });
});
