// IPC: the simulator process.
import { ipcMain } from 'electron';
import { IpcChannel, type IpcResult } from '../../shared/ipc';
import { logServerOutput, serverLogHistory, simulatorProcess } from '../simulator/process';
import { ipcResult, toErrorMessage } from './result';

export function registerServerHandlers() {
  // The page shows the result (a notice, or the error): no box from here.
  ipcMain.handle(IpcChannel.restartServer, async (): Promise<IpcResult> => {
    try {
      await simulatorProcess.restart();
      logServerOutput('out', 'Server restarted.');
      return { success: true };
    } catch (error) {
      const message = toErrorMessage(error);
      logServerOutput('error', `Restart failed: ${message}`);
      return { success: false, message };
    }
  });

  // Resolves when the simulator accepts requests; waits while it is (re)starting.
  ipcMain.handle(IpcChannel.waitForSimulator, () => ipcResult(() => simulatorProcess.whenReady()));

  ipcMain.handle(IpcChannel.getServerLog, () => ipcResult(() => serverLogHistory()));
}
