// electron/ipc/file.ts
import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as pathModule from 'path';

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readProjectSic(projectRoot: string): { asm: string[]; main: string } | null {
  const sicPath = pathModule.join(projectRoot, 'project.sic');
  if (!fs.existsSync(sicPath)) return null;
  try {
    const raw = fs.readFileSync(sicPath, 'utf8');
    const json = JSON.parse(raw);
    const asm: string[] = Array.isArray(json.asm) ? json.asm : [];
    const main: string = typeof json.main === 'string' ? json.main : '';
    return { asm, main };
  } catch {
    return null;
  }
}

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

// Build a tree-ish flat list that includes intermediate folders for the asm files
function buildAsmTreeEntries(projectRoot: string, asmRelFiles: string[]): string[] {
  const set = new Set<string>();
  for (const rel of asmRelFiles) {
    const norm = rel.replace(/^\.?\/*/, ''); // normalize: remove leading ./ or /
    const parts = norm.split('/');
    // add intermediate dirs
    let acc = '';
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? pathModule.join(acc, parts[i]) : parts[i];
      set.add(acc + '/');
    }
    // add file
    set.add(norm);
  }
  return Array.from(set);
}

// NEW: createNewProject now asks parent dir AND project name, then creates <parent>/<name>/*
async function createNewProjectInteractive() {
  // 1) Ask for parent directory
  const parentPick = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose parent folder for the new project',
  });
  if (parentPick.canceled || parentPick.filePaths.length === 0) {
    return { success: false, message: 'Project creation canceled.' };
  }
  const parentDir = parentPick.filePaths[0];

  // 2) Ask for project name (using a save dialog to capture a name as a path)
  const savePick = await dialog.showSaveDialog({
    title: 'Enter project name',
    buttonLabel: 'Create Project',
    defaultPath: pathModule.join(parentDir, 'NewProject'),
    properties: ['showOverwriteConfirmation'],
  });
  if (savePick.canceled || !savePick.filePath) {
    return { success: false, message: 'Project name input canceled.' };
  }

  // Treat the chosen filePath as the project folder path
  const projectPath = savePick.filePath;
  const projectName = pathModule.basename(projectPath);

  try {
    // Ensure project root
    ensureDir(projectPath);

    // Required layout:
    // <root>/main.asm
    // <root>/.out/
    // <root>/project.sic
    const outDir = pathModule.join(projectPath, '.out');
    ensureDir(outDir);

    const mainAsmPath = pathModule.join(projectPath, 'main.asm');

    fs.writeFileSync(
      mainAsmPath,
      `; main.asm (root)\n; put your assembly here\n`,
      'utf8'
    );

    // NOTE: asm entries are RELATIVE; main has NO extension
    const sic = {
      asm: ['main.asm'],
      main: 'main',
    };
    fs.writeFileSync(pathModule.join(projectPath, 'project.sic'), JSON.stringify(sic, null, 2), 'utf8');

    return {
      success: true,
      data: {
        name: projectName,
        path: projectPath,
        settings: sic,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// IPC: returns ONLY files under project.sic "asm", plus .out/ content; includes folder nodes
ipcMain.handle('getFileList', async (_event, dirPath: string) => {
  try {
    const projectRoot = pathModule.resolve(dirPath);
    const sic = readProjectSic(projectRoot);
    const asmRel = sic?.asm ?? [];

    const asmEntries = buildAsmTreeEntries(projectRoot, asmRel);
    const outEntries = listOutDirRelative(projectRoot);

    // final list: asm structure + .out (constant behavior)
    return {
      success: true,
      data: [...asmEntries, ...outEntries],
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// IPC: create new project (interactive, asks for parent dir + name)
ipcMain.handle('createNewProject', async () => {
  return await createNewProjectInteractive();
});

// IPC: open existing project by picking a .sic file and loading it
ipcMain.handle('openProject', async () => {
  try {
    const pick = await dialog.showOpenDialog({
      title: 'Open project (.sic)',
      properties: ['openFile'],
      filters: [{ name: 'SIC Project', extensions: ['sic'] }],
    });
    if (pick.canceled || pick.filePaths.length === 0) {
      return { success: false, message: 'Open project canceled.' };
    }

    const sicPath = pick.filePaths[0];
    const projectRoot = pathModule.dirname(sicPath);
    const projectName = pathModule.basename(projectRoot);

    const sicRaw = fs.readFileSync(sicPath, 'utf8');
    const sic = JSON.parse(sicRaw);

    // Normalize fields
    const asm: string[] = Array.isArray(sic.asm) ? sic.asm : [];
    const main: string = typeof sic.main === 'string' ? sic.main : '';

    return {
      success: true,
      data: {
        name: projectName,
        path: projectRoot,
        settings: { asm, main },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('readFile', async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, data: content };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('saveFile', async (_event, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content);
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('createFolder', async (_event, parentPath: string, folderName: string) => {
  try {
    const fullPath = pathModule.join(parentPath, folderName);
    fs.mkdirSync(fullPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
});
