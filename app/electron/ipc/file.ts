// electron/ipc/file.ts
import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as pathModule from 'path';

interface FileDevice {
  index: number;
  filename: string;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readProjectSic(projectRoot: string): { asm: string[]; main: string; filedevices: FileDevice[] } | null {
  const sicPath = pathModule.join(projectRoot, 'project.sic');
  if (!fs.existsSync(sicPath)) return null;
  try {
    const raw = fs.readFileSync(sicPath, 'utf8');
    const json = JSON.parse(raw);
    const asm: string[] = Array.isArray(json.asm) ? json.asm : [];
    const main: string = typeof json.main === 'string' ? json.main : '';
    const filedevices: FileDevice[] = Array.isArray(json.filedevices) ? json.filedevices : [];
    return { asm, main, filedevices };
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
    const fullPath = pathModule.join(projectRoot, norm);

    // 실제 파일이 존재하는지 확인
    if (!fs.existsSync(fullPath)) {
      continue; // 파일이 존재하지 않으면 건너뛰기
    }

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

// Get all .asm files in the project root (excluding .out)
function getAllAsmFiles(projectRoot: string): string[] {
  const asmFiles: string[] = [];

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
        } else if (item.toLowerCase().endsWith('.asm')) {
          const relPath = relativePath ? `${relativePath}/${item}` : item;
          asmFiles.push(relPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
      console.warn(`Cannot read directory: ${currentPath}`, error);
    }
  };

  walk(projectRoot);
  return asmFiles;
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

    fs.writeFileSync(mainAsmPath, `; main.asm (root)\n; put your assembly here\n`, 'utf8');

    // NOTE: asm entries are RELATIVE; main has NO extension
    const sic = {
      asm: ['main.asm'],
      main: 'main',
      filedevices: [],
    };
    fs.writeFileSync(
      pathModule.join(projectPath, 'project.sic'),
      JSON.stringify(sic, null, 2),
      'utf8',
    );

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

ipcMain.handle('getFileList', async (_event, dirPath: string) => {
  try {
    const projectRoot = pathModule.resolve(dirPath);

    // 모든 파일 수집 (단, .out 제외)
    const allFiles = getAllFiles(projectRoot);

    // project.sic은 무조건 포함 (혹시 누락됐을 경우 대비)
    if (!allFiles.includes('project.sic')) {
      allFiles.push('project.sic');
    }

    // .out은 listOutDirRelative로 따로 추가
    const outEntries = listOutDirRelative(projectRoot);
    const allDirectories = getAllDirectories(projectRoot);

    // 합치기
    const allEntries = [...allFiles, ...outEntries, ...allDirectories];
    const uniqueEntries = [...new Set(allEntries)];

    return {
      success: true,
      data: uniqueEntries,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// // IPC: returns asm files, .out content, and all directories
// ipcMain.handle('getFileList', async (_event, dirPath: string) => {
//   try {
//     const projectRoot = pathModule.resolve(dirPath);
//     const sic = readProjectSic(projectRoot);
//     const asmRel = sic?.asm ?? [];

//     // 실제 파일 시스템에서 .asm 파일들 찾기
//     const actualAsmFiles = getAllAsmFiles(projectRoot);

//     // project.sic에 등록된 파일들과 실제 파일들을 합치고 중복 제거
//     const allAsmFiles = [...new Set([...asmRel, ...actualAsmFiles])];

//     const asmEntries = buildAsmTreeEntries(projectRoot, allAsmFiles);
//     const outEntries = listOutDirRelative(projectRoot);
//     const sicEntries = ['project.sic'];
//     const allDirectories = getAllDirectories(projectRoot);

//     // Combine all entries and remove duplicates
//     const allEntries = [...asmEntries, ...outEntries, ...allDirectories, ...sicEntries];
//     const uniqueEntries = [...new Set(allEntries)];

//     // final list: asm structure + .out + all directories
//     return {
//       success: true,
//       data: uniqueEntries,
//     };
//   } catch (error) {
//     return {
//       success: false,
//       message: error instanceof Error ? error.message : 'Unknown error',
//     };
//   }
// });

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
    const filedevices: FileDevice[] = Array.isArray(sic.filedevices) ? sic.filedevices : [];

    return {
      success: true,
      data: {
        name: projectName,
        path: projectRoot,
        settings: { asm, main, filedevices },
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

// File picker (returns absolute path)
ipcMain.handle('pickFile', async () => {
  try {
    const pick = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Choose a file',
    });
    if (pick.canceled || pick.filePaths.length === 0) {
      return { success: false, message: 'canceled' };
    }
    return { success: true, data: pick.filePaths[0] };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle(
  'createNewFile',
  async (_event, { folderPath, fileName }: { folderPath: string; fileName: string }) => {
    try {
      const fullPath = pathModule.join(folderPath, fileName);

      // 파일이 이미 존재하는지 확인
      if (fs.existsSync(fullPath)) {
        return { success: false, message: 'File already exists' };
      }

      // 빈 파일 생성
      fs.writeFileSync(fullPath, '', 'utf8');
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
);

ipcMain.handle(
  'createNewFolder',
  async (_event, { folderPath, folderName }: { folderPath: string; folderName: string }) => {
    try {
      const fullPath = pathModule.join(folderPath, folderName);

      // 폴더가 이미 존재하는지 확인
      if (fs.existsSync(fullPath)) {
        return { success: false, message: 'Folder already exists' };
      }

      // 폴더 생성
      fs.mkdirSync(fullPath, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
);

// 파일 삭제 IPC 핸들러
ipcMain.handle(
  'deleteFile',
  async (_event, { projectPath, relativePath }: { projectPath: string; relativePath: string }) => {
    try {
      const fullPath = pathModule.join(projectPath, relativePath);

      // 파일이 존재하는지 확인
      if (!fs.existsSync(fullPath)) {
        return { success: false, message: 'File does not exist' };
      }

      // 파일 삭제
      fs.unlinkSync(fullPath);
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
);

// 폴더 삭제 IPC 핸들러 (재귀적으로 모든 내용 삭제)
ipcMain.handle(
  'deleteFolder',
  async (_event, { projectPath, relativePath }: { projectPath: string; relativePath: string }) => {
    try {
      const fullPath = pathModule.join(projectPath, relativePath);

      // 폴더가 존재하는지 확인
      if (!fs.existsSync(fullPath)) {
        return { success: false, message: 'Folder does not exist' };
      }

      // 폴더와 그 안의 모든 내용을 재귀적으로 삭제
      const deleteRecursive = (path: string) => {
        if (fs.statSync(path).isDirectory()) {
          fs.readdirSync(path).forEach(file => {
            const curPath = pathModule.join(path, file);
            deleteRecursive(curPath);
          });
          fs.rmdirSync(path);
        } else {
          fs.unlinkSync(path);
        }
      };

      deleteRecursive(fullPath);
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
);
