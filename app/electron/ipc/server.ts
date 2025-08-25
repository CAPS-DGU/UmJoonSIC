// electron/ipc/server.ts
import { ipcMain } from 'electron';

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
