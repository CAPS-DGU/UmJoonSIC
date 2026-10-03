// IPC: the simulator process.
import { ipcMain, dialog, BrowserWindow, type MessageBoxOptions } from 'electron';
import { IpcChannel, type IpcResult } from '../../shared/ipc';
import { restartServerProcess } from '../simulator/process';
import { toErrorMessage } from './result';

const okBox = (
  options: Pick<MessageBoxOptions, 'type' | 'title' | 'message'>,
): MessageBoxOptions => ({
  ...options,
  buttons: ['확인'],
  defaultId: 0,
  noLink: true,
});

export function registerServerHandlers() {
  ipcMain.handle(IpcChannel.restartServer, async (): Promise<IpcResult> => {
    try {
      await restartServerProcess();
      const restarted = okBox({
        type: 'info',
        title: '서버 재시작',
        message: '서버가 성공적으로 재시작되었습니다.',
      });
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        await dialog.showMessageBox(win, restarted);
      } else {
        await dialog.showMessageBox(restarted);
      }
      return { success: true };
    } catch (error) {
      const message = toErrorMessage(error);
      await dialog.showMessageBox(okBox({ type: 'error', title: '서버 재시작 실패', message }));
      return { success: false, message };
    }
  });
}
