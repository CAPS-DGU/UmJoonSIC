import { describe, expect, it } from 'vitest';
import { toProjectRelativePath } from '@/lib/projectPath';

describe('toProjectRelativePath', () => {
  it('cuts the project folder off', () => {
    expect(toProjectRelativePath('/home/u/proj', '/home/u/proj/sub/main.asm')).toBe('sub/main.asm');
  });

  it('uses / on Windows paths', () => {
    expect(toProjectRelativePath('C:\\proj', 'C:\\proj\\sub\\main.asm')).toBe('sub/main.asm');
  });

  it('returns a path outside the project as it is', () => {
    expect(toProjectRelativePath('/home/u/proj', '/tmp/x.asm')).toBe('/tmp/x.asm');
  });
});
