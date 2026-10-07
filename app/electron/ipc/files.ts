// IPC: the project's files (listing, reading, writing, creating, deleting).
import { dialog, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as pathModule from 'path';
import { IpcChannel, type IpcResult, type PickFileOptions } from '../../shared/ipc';
import { texts } from '../i18n';
import { listProjectEntries } from '../project/projectFiles';
import { checkName } from './project';
import { CodedError, ipcResult, toErrorMessage } from './result';

function deleteRecursive(target: string) {
  if (fs.statSync(target).isDirectory()) {
    fs.readdirSync(target).forEach(name => deleteRecursive(pathModule.join(target, name)));
    fs.rmdirSync(target);
  } else {
    fs.unlinkSync(target);
  }
}

export function registerFileHandlers() {
  ipcMain.handle(IpcChannel.getFileList, (_event, dirPath: string) =>
    ipcResult(() => listProjectEntries(dirPath)),
  );

  ipcMain.handle(IpcChannel.readFile, (_event, filePath: string) =>
    ipcResult(() => fs.readFileSync(filePath, 'utf8')),
  );

  ipcMain.handle(IpcChannel.saveFile, (_event, filePath: string, content: string) =>
    ipcResult(() => fs.writeFileSync(filePath, content)),
  );

  // File picker; resolves to the absolute path. It opens in `defaultPath` (the project
  // folder). With `save`, it is a Save dialog, where a new file's name can be typed (an
  // output device's file need not exist yet), with `suggestedName` filled in.
  ipcMain.handle(
    IpcChannel.pickFile,
    async (_event, options: PickFileOptions = {}): Promise<IpcResult<string>> => {
      try {
        if (options.save) {
          const pick = await dialog.showSaveDialog({
            title: texts().chooseOutputTitle,
            defaultPath: pathModule.join(options.defaultPath ?? '', options.suggestedName ?? ''),
          });
          if (pick.canceled || !pick.filePath) {
            return { success: false, code: 'canceled', message: 'canceled' };
          }
          return { success: true, data: pick.filePath };
        }
        const pick = await dialog.showOpenDialog({
          properties: ['openFile'],
          title: texts().chooseFileTitle,
          ...(options.defaultPath ? { defaultPath: options.defaultPath } : {}),
        });
        if (pick.canceled || pick.filePaths.length === 0) {
          return { success: false, code: 'canceled', message: 'canceled' };
        }
        return { success: true, data: pick.filePaths[0] };
      } catch (error) {
        return { success: false, message: toErrorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    IpcChannel.createNewFile,
    (_event, { folderPath, fileName }: { folderPath: string; fileName: string }) =>
      ipcResult(() => {
        checkName(fileName);
        const fullPath = pathModule.join(folderPath, fileName);
        if (fs.existsSync(fullPath)) throw new CodedError('exists', fileName);
        fs.writeFileSync(fullPath, '', 'utf8');
      }),
  );

  ipcMain.handle(
    IpcChannel.createNewFolder,
    (_event, { folderPath, folderName }: { folderPath: string; folderName: string }) =>
      ipcResult(() => {
        checkName(folderName);
        const fullPath = pathModule.join(folderPath, folderName);
        if (fs.existsSync(fullPath)) throw new CodedError('exists', folderName);
        fs.mkdirSync(fullPath, { recursive: true });
      }),
  );

  ipcMain.handle(
    IpcChannel.deleteFile,
    (_event, { projectPath, relativePath }: { projectPath: string; relativePath: string }) =>
      ipcResult(() => {
        const fullPath = pathModule.join(projectPath, relativePath);
        if (!fs.existsSync(fullPath)) throw new Error('File does not exist');
        fs.unlinkSync(fullPath);
      }),
  );

  // Deletes the folder and everything in it.
  ipcMain.handle(
    IpcChannel.deleteFolder,
    (_event, { projectPath, relativePath }: { projectPath: string; relativePath: string }) =>
      ipcResult(() => {
        const fullPath = pathModule.join(projectPath, relativePath);
        if (!fs.existsSync(fullPath)) throw new Error('Folder does not exist');
        deleteRecursive(fullPath);
      }),
  );

  // Rename a file or folder in place (the new name is a name, not a path).
  ipcMain.handle(
    IpcChannel.renamePath,
    (
      _event,
      {
        projectPath,
        relativePath,
        newName,
      }: { projectPath: string; relativePath: string; newName: string },
    ) =>
      ipcResult(() => {
        checkName(newName);
        const from = pathModule.join(projectPath, relativePath);
        const to = pathModule.join(pathModule.dirname(from), newName.trim());
        if (!fs.existsSync(from)) throw new CodedError('notFound', relativePath);
        // main.asm -> Main.asm: on Windows and macOS `to` "exists" because it is the same
        // file; only another file of that name is a conflict.
        const caseOnly = from !== to && from.toLowerCase() === to.toLowerCase();
        if (!caseOnly && fs.existsSync(to)) throw new CodedError('exists', newName);
        fs.renameSync(from, to);
      }),
  );

  // Show a file or folder in the system's file manager.
  ipcMain.handle(IpcChannel.showInFolder, (_event, absolutePath: string) =>
    // The renderer joins with '/' (C:\…\HW1/sub/x.asm); Windows' file manager wants one kind.
    ipcResult(() => shell.showItemInFolder(pathModule.normalize(absolutePath))),
  );

  ipcMain.handle(IpcChannel.pathExists, (_event, paths: string[]) =>
    ipcResult(() => paths.map(p => typeof p === 'string' && p !== '' && fs.existsSync(p))),
  );
}
