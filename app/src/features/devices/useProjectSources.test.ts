import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/project/projectStore', () => ({ useProjectStore: () => null }));
vi.mock('@/features/editor/editorTabStore', () => ({ useEditorTabStore: () => null }));

const { mainFileOf } = await import('./useProjectSources');

describe('the main program’s file', () => {
  const sections = { 'main.asm': ['MAIN'], 'lib/io.asm': ['io'] };
  it('is the only file, whatever main says', () => {
    expect(mainFileOf(['a.asm'], 'other', {})).toBe('a.asm');
  });
  it('is the file defining the section main names, matched exactly', () => {
    expect(mainFileOf(['lib/io.asm', 'main.asm'], 'MAIN', sections)).toBe('main.asm');
    expect(mainFileOf(['lib/io.asm', 'main.asm'], 'main', sections)).toBeNull();
  });
  it('is the first file without a main', () => {
    expect(mainFileOf(['lib/io.asm', 'main.asm'], '', sections)).toBe('lib/io.asm');
  });
  it('is guessed from the file name while the sources are not read yet', () => {
    expect(mainFileOf(['io.asm', 'main.asm'], 'main', {})).toBe('main.asm');
  });
});
