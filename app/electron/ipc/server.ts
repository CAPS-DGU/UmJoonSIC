// electron/ipc/server.ts
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { restartServerProcess } from '../setup';

ipcMain.handle('loadAsm', async (_event, args: { port: number; filePath: string }) => {
  try {
    const { port, filePath } = args;
    const url = `http://localhost:${port}/load?filepath=${encodeURIComponent(filePath)}`;

    const res = await fetch(url, {
      method: 'POST',
    });

    const contentType = res.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await res.json() : await res.text();

    return {
      success: res.ok,
      status: res.status,
      data: body,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('restartServer', async () => {
  try {
    await restartServerProcess();
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: '서버 재시작',
        message: '서버가 성공적으로 재시작되었습니다.',
        buttons: ['확인'],
        defaultId: 0,
        noLink: true,
      });
    } else {
      await dialog.showMessageBox({
        type: 'info',
        title: '서버 재시작',
        message: '서버가 성공적으로 재시작되었습니다.',
        buttons: ['확인'],
        defaultId: 0,
        noLink: true,
      });
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await dialog.showMessageBox({
      type: 'error',
      title: '서버 재시작 실패',
      message: msg,
      buttons: ['확인'],
      defaultId: 0,
      noLink: true,
    });
    return { success: false, message: msg };
  }
});
