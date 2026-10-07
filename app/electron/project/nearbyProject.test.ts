import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nearbyProject } from './nearbyProject';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umjoonsic-near-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const write = (rel: string, content = '') => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
};

describe('the project of an assembly file opened from outside', () => {
  it('is the project.sic in the same folder', () => {
    const project = write('hw/project.sic', '{}');
    expect(nearbyProject(write('hw/main.asm'))).toBe(project);
  });

  it('is the nearest project.sic above, assembled or not (lib/new.asm belongs to hw)', () => {
    const project = write('hw/project.sic', '{}');
    expect(nearbyProject(write('hw/lib/new.asm'))).toBe(project);
    expect(nearbyProject(write('hw/a/b/c/deep.asm'))).toBe(project);
  });

  it('is the nearest when projects are nested', () => {
    write('course/project.sic', '{}');
    const inner = write('course/hw2/project.sic', '{}');
    expect(nearbyProject(write('course/hw2/lib/x.asm'))).toBe(inner);
  });

  it('is none further up than three folders, or without any', () => {
    write('top/project.sic', '{}');
    expect(nearbyProject(write('top/a/b/c/d/far.asm'))).toBeNull();
    expect(nearbyProject(write('loose/x.asm'))).toBeNull();
  });
});
