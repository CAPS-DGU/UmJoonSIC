import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProjectSkeleton, loadProjectFromSic } from './projectFiles';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umjoonsic-test-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const loadWith = (sic: object) => {
  const sicPath = path.join(dir, 'project.sic');
  fs.writeFileSync(sicPath, JSON.stringify(sic));
  return loadProjectFromSic(sicPath).settings;
};

describe('the machine mode in project.sic', () => {
  it('is read as written', () => {
    expect(loadWith({ asm: [], main: '', filedevices: [], mode: 'SICXE' }).mode).toBe('SICXE');
    expect(loadWith({ asm: [], main: '', filedevices: [], mode: 'SIC' }).mode).toBe('SIC');
  });

  it('is also understood in other spellings', () => {
    expect(loadWith({ mode: 'sicxe' }).mode).toBe('SICXE');
    expect(loadWith({ mode: 'SIC/XE' }).mode).toBe('SICXE');
    expect(loadWith({ mode: 'sic' }).mode).toBe('SIC');
  });

  it('is absent when project.sic does not say, or says something else', () => {
    expect(loadWith({ asm: ['main.asm'], main: 'main', filedevices: [] })).toEqual({
      asm: ['main.asm'],
      main: 'main',
      filedevices: [],
    });
    expect(loadWith({ mode: 'XE' }).mode).toBeUndefined();
    expect(loadWith({ mode: 3 }).mode).toBeUndefined();
  });

  it('is written into a new project, which then loads with it', () => {
    const project = createProjectSkeleton(path.join(dir, 'New'), 'SICXE');
    expect(project.settings.mode).toBe('SICXE');
    const loaded = loadProjectFromSic(path.join(dir, 'New', 'project.sic'));
    expect(loaded.settings).toEqual(project.settings);
    expect(fs.readFileSync(path.join(dir, 'New', 'main.asm'), 'utf8')).toContain('. main.asm');
  });
});
