// IPC: creating and opening projects.
import { dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import * as pathModule from 'path';
import { IpcChannel, type IpcResult, type MachineMode, type ProjectInfo } from '../../shared/ipc';
import { texts } from '../i18n';
import { getRecentProjects, noteRecentProject } from '../preferences';
import { createProjectSkeleton, loadProjectFromSic } from '../project/projectFiles';
import { CodedError, ipcResult } from './result';

/** Characters a file or folder name cannot contain on one of the systems students use. */
const BAD_NAME = /[\\/:*?"<>|]/;

/** Throw a CodedError unless `name` can be a file or folder name. */
export function checkName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..') throw new CodedError('emptyName', name);
  if (BAD_NAME.test(trimmed)) throw new CodedError('badName', name);
}

/** Load a project and remember it for the welcome screen. */
function openAndRemember(sicPath: string): ProjectInfo {
  const project = loadProjectFromSic(sicPath);
  noteRecentProject({ name: project.name, sicPath: pathModule.join(project.path, 'project.sic') });
  return project;
}

export function registerProjectHandlers() {
  // A folder for a new project; resolves to its path, or fails ('canceled').
  ipcMain.handle(
    IpcChannel.pickFolder,
    async (
      _event,
      { title, defaultPath }: { title: string; defaultPath?: string },
    ): Promise<IpcResult<string>> => {
      const pick = await dialog.showOpenDialog({
        title,
        defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      });
      if (pick.canceled || pick.filePaths.length === 0) return { success: false, code: 'canceled' };
      return { success: true, data: pick.filePaths[0] };
    },
  );

  // Create <parentDir>/<name>/ with main.asm and project.sic.
  ipcMain.handle(
    IpcChannel.createProjectAt,
    (_event, { parentDir, name, mode }: { parentDir: string; name: string; mode: MachineMode }) =>
      ipcResult(() => {
        checkName(name);
        if (!parentDir || !fs.existsSync(parentDir)) throw new CodedError('noFolder', parentDir);
        const projectPath = pathModule.join(parentDir, name.trim());
        if (fs.existsSync(projectPath)) throw new CodedError('exists', projectPath);
        const project = createProjectSkeleton(projectPath, mode === 'SICXE' ? 'SICXE' : 'SIC');
        noteRecentProject({
          name: project.name,
          sicPath: pathModule.join(projectPath, 'project.sic'),
        });
        return project;
      }),
  );

  // Pick a project.sic and load the project around it.
  ipcMain.handle(IpcChannel.openProject, async (): Promise<IpcResult<ProjectInfo>> => {
    const t = texts();
    const pick = await dialog.showOpenDialog({
      title: t.openProjectTitle,
      properties: ['openFile'],
      filters: [{ name: t.sicFilter, extensions: ['sic'] }],
    });
    if (pick.canceled || pick.filePaths.length === 0) {
      return { success: false, code: 'canceled' };
    }
    return ipcResult(() => openAndRemember(pick.filePaths[0]));
  });

  // Load a project whose path is already known (recent list, file association, second instance).
  ipcMain.handle(IpcChannel.openProjectByPath, async (_event, sicPath: string) => {
    if (!sicPath || typeof sicPath !== 'string') {
      return { success: false, code: 'notFound', message: String(sicPath) };
    }
    return ipcResult(() => openAndRemember(sicPath));
  });

  ipcMain.handle(IpcChannel.getRecentProjects, () => ipcResult(() => getRecentProjects()));
}
