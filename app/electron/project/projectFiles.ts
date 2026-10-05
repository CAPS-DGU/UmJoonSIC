// Reading and creating projects on disk. No Electron APIs here: plain filesystem work.
import * as fs from 'fs';
import * as pathModule from 'path';
import type { MachineMode, ProjectInfo, ProjectSettings } from '../../shared/ipc';

/** The machine mode written in a project.sic: "SIC" or "SICXE" (also "sic", "SIC/XE"). */
function readMode(value: unknown): MachineMode | undefined {
  if (typeof value !== 'string') return undefined;
  const mode = value.toUpperCase().replace('/', '');
  return mode === 'SIC' || mode === 'SICXE' ? mode : undefined;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

/** Read a project.sic and describe the project around it. Throws if the file is missing or not JSON. */
export function loadProjectFromSic(sicPath: string): ProjectInfo {
  const resolved = pathModule.resolve(sicPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('Project file not found.');
  }

  const projectRoot = pathModule.dirname(resolved);
  const projectName = pathModule.basename(projectRoot);

  const sicRaw = fs.readFileSync(resolved, 'utf8');
  const sic = JSON.parse(sicRaw) as {
    asm?: unknown;
    main?: unknown;
    filedevices?: unknown;
    mode?: unknown;
  };

  const asm: string[] = Array.isArray(sic.asm) ? sic.asm.map(item => String(item)) : [];
  const mainProgram = typeof sic.main === 'string' ? sic.main : '';
  const filedevices = Array.isArray(sic.filedevices)
    ? (sic.filedevices as Array<{ index: number; filename: string }>).map(device => ({
        index: Number(device.index),
        filename: String(device.filename ?? ''),
      }))
    : [];

  const mode = readMode(sic.mode);

  return {
    name: projectName,
    path: projectRoot,
    settings: {
      asm,
      main: mainProgram,
      filedevices,
      ...(mode && { mode }),
    },
  };
}

/**
 * Create the layout of a new project:
 *   <root>/main.asm, <root>/.out/, <root>/project.sic
 * `asm` entries are relative paths; `main` has no extension; `mode` is the machine mode.
 */
export function createProjectSkeleton(projectPath: string, mode: MachineMode): ProjectInfo {
  ensureDir(projectPath);
  ensureDir(pathModule.join(projectPath, '.out'));

  fs.writeFileSync(
    pathModule.join(projectPath, 'main.asm'),
    // '.' starts a comment in SIC/XE assembly (';' is a syntax error).
    `. main.asm (root)\n. put your assembly here\n`,
    'utf8',
  );

  const settings: ProjectSettings = {
    asm: ['main.asm'],
    main: 'main',
    filedevices: [],
    mode,
  };
  fs.writeFileSync(
    pathModule.join(projectPath, 'project.sic'),
    JSON.stringify(settings, null, 2),
    'utf8',
  );

  return { name: pathModule.basename(projectPath), path: projectPath, settings };
}

// Files of the project, relative to its root, excluding .out
function getAllFiles(projectRoot: string): string[] {
  const files: string[] = [];

  const walk = (currentPath: string, relativePath: string = '') => {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        // Skip .out directory
        if (item === '.out') continue;

        const fullPath = pathModule.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const relPath = relativePath ? `${relativePath}/${item}` : item;
          walk(fullPath, relPath);
        } else {
          const relPath = relativePath ? `${relativePath}/${item}` : item;
          files.push(relPath);
        }
      }
    } catch (error) {
      console.warn(`Cannot read directory: ${currentPath}`, error);
    }
  };

  walk(projectRoot);
  return files;
}

// .out and everything in it; directories end with '/'
function listOutDirRelative(projectRoot: string): string[] {
  const outRoot = pathModule.join(projectRoot, '.out');
  const rels: string[] = [];
  if (!fs.existsSync(outRoot)) return rels;

  const walk = (abs: string) => {
    const rel = pathModule.relative(projectRoot, abs);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      rels.push(rel.endsWith('/') ? rel : rel + '/');
      for (const name of fs.readdirSync(abs)) {
        walk(pathModule.join(abs, name));
      }
    } else {
      rels.push(rel);
    }
  };

  // always include directory node even if empty
  rels.push('.out/');
  for (const name of fs.readdirSync(outRoot)) {
    walk(pathModule.join(outRoot, name));
  }
  return rels;
}

// Get all directories in the project root (excluding .out)
function getAllDirectories(projectRoot: string): string[] {
  const dirs: string[] = [];

  const walk = (currentPath: string, relativePath: string = '') => {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        // Skip .out directory to avoid duplication
        if (item === '.out') continue;

        const fullPath = pathModule.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const relPath = relativePath ? `${relativePath}/${item}/` : `${item}/`;
          dirs.push(relPath);
          walk(fullPath, relPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
      console.warn(`Cannot read directory: ${currentPath}`, error);
    }
  };

  walk(projectRoot);
  return dirs;
}

/**
 * Everything the file tree shows, as paths relative to the project root:
 * all files, then .out and its contents, then every directory (with a trailing '/').
 */
export function listProjectEntries(dirPath: string): string[] {
  const projectRoot = pathModule.resolve(dirPath);

  const allFiles = getAllFiles(projectRoot);
  // project.sic is always listed, even if it is missing on disk
  if (!allFiles.includes('project.sic')) {
    allFiles.push('project.sic');
  }

  const outEntries = listOutDirRelative(projectRoot);
  const allDirectories = getAllDirectories(projectRoot);

  return [...new Set([...allFiles, ...outEntries, ...allDirectories])];
}
