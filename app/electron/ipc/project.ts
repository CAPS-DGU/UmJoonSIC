// IPC: creating and opening projects.
import { ipcMain, dialog } from 'electron';
import * as pathModule from 'path';
import { IpcChannel, type IpcResult, type MachineMode, type ProjectInfo } from '../../shared/ipc';
import { createProjectSkeleton, loadProjectFromSic } from '../project/projectFiles';
import { ipcResult, toErrorMessage } from './result';

/** Ask for a parent folder, then for the project's name, and create <parent>/<name>/. */
async function createNewProjectInteractive(mode: MachineMode): Promise<IpcResult<ProjectInfo>> {
  const parentPick = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose parent folder for the new project',
  });
  if (parentPick.canceled || parentPick.filePaths.length === 0) {
    return { success: false, message: 'Project creation canceled.' };
  }
  const parentDir = parentPick.filePaths[0];

  // A save dialog is used to capture the name: the chosen file path becomes the project folder.
  const savePick = await dialog.showSaveDialog({
    title: 'Enter project name',
    buttonLabel: 'Create Project',
    defaultPath: pathModule.join(parentDir, 'NewProject'),
    properties: ['showOverwriteConfirmation'],
  });
  if (savePick.canceled || !savePick.filePath) {
    return { success: false, message: 'Project name input canceled.' };
  }

  try {
    return { success: true, data: createProjectSkeleton(savePick.filePath, mode) };
  } catch (error) {
    return { success: false, message: toErrorMessage(error) };
  }
}

export function registerProjectHandlers() {
  ipcMain.handle(IpcChannel.createNewProject, (_event, mode: unknown) =>
    createNewProjectInteractive(mode === 'SICXE' ? 'SICXE' : 'SIC'),
  );

  // Pick a .sic file and load the project around it.
  ipcMain.handle(IpcChannel.openProject, async (): Promise<IpcResult<ProjectInfo>> => {
    try {
      const pick = await dialog.showOpenDialog({
        title: 'Open project (.sic)',
        properties: ['openFile'],
        filters: [{ name: 'SIC Project', extensions: ['sic'] }],
      });
      if (pick.canceled || pick.filePaths.length === 0) {
        return { success: false, message: 'Open project canceled.' };
      }
      return { success: true, data: loadProjectFromSic(pick.filePaths[0]) };
    } catch (error) {
      return { success: false, message: toErrorMessage(error) };
    }
  });

  // Load a project whose path is already known (file association, second instance).
  ipcMain.handle(IpcChannel.openProjectByPath, async (_event, sicPath: string) => {
    if (!sicPath || typeof sicPath !== 'string') {
      console.warn('[UmJoonSIC] openProjectByPath called with invalid path:', sicPath);
      return { success: false, message: 'Invalid project path.' };
    }
    const result = await ipcResult(() => loadProjectFromSic(sicPath));
    if (!result.success) {
      console.error('[UmJoonSIC] openProjectByPath failed:', result.message);
    }
    return result;
  });
}
