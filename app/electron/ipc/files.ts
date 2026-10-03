// IPC: the project's files (listing, reading, writing, creating, deleting).
import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as pathModule from 'path';
import { IpcChannel, type IpcResult } from '../../shared/ipc';
import { listProjectEntries } from '../project/projectFiles';
import { ipcResult, toErrorMessage } from './result';

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

  // File picker; resolves to the absolute path.
  ipcMain.handle(IpcChannel.pickFile, async (): Promise<IpcResult<string>> => {
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
      return { success: false, message: toErrorMessage(error) };
    }
  });

  ipcMain.handle(
    IpcChannel.createNewFile,
    (_event, { folderPath, fileName }: { folderPath: string; fileName: string }) =>
      ipcResult(() => {
        const fullPath = pathModule.join(folderPath, fileName);
        if (fs.existsSync(fullPath)) throw new Error('File already exists');
        fs.writeFileSync(fullPath, '', 'utf8');
      }),
  );

  ipcMain.handle(
    IpcChannel.createNewFolder,
    (_event, { folderPath, folderName }: { folderPath: string; folderName: string }) =>
      ipcResult(() => {
        const fullPath = pathModule.join(folderPath, folderName);
        if (fs.existsSync(fullPath)) throw new Error('Folder already exists');
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
}
