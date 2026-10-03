// The simulator process: start, initialise, stop, restart.
import { app, BrowserWindow } from 'electron';
import { type ChildProcess, spawn } from 'child_process';
import net from 'node:net';
import { AppEvent } from '../../shared/ipc';
import { checkJARUpdate } from './jar';
import { getJavaPath, getServerPath, SIMULATOR_PORT } from './paths';

let currentServer: ChildProcess | null = null;

export async function initServer() {
  const res = await fetch(`http://localhost:${SIMULATOR_PORT}/begin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'sic',
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to initialize server');
  }

  const data = (await res.json()) as { message?: string };
  console.log('Server initialized:', data.message);
}

async function waitForPortFree(port: number, host = '127.0.0.1', timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const isBusy = await isPortInUse(port, host);
    if (!isBusy) return;
    await new Promise(r => setTimeout(r, 150));
  }
  // timeout: continue; spawn may still fail which we handle by stderr
}

function isPortInUse(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise(resolve => {
    net
      .createServer()
      .once('error', () => resolve(true))
      .once('listening', function (this: net.Server) {
        this.close(() => resolve(false));
      })
      .listen(port, host);
  });
}

export async function runServer(): Promise<ChildProcess> {
  const javaPath = getJavaPath();
  if (!javaPath) {
    console.error('Java 경로를 찾을 수 없습니다.');
    app.quit();
    throw new Error('Java path not found');
  }

  await waitForPortFree(SIMULATOR_PORT);

  const serverProcess = spawn(javaPath, ['-jar', getServerPath(), String(SIMULATOR_PORT)]);
  currentServer = serverProcess;

  if (serverProcess && serverProcess.stdout && serverProcess.stderr) {
    const broadcast = (type: 'out' | 'error', message: string) => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        try {
          win.webContents.send(AppEvent.serverLog, { type, message });
        } catch {
          // the window is being destroyed; nothing to deliver to
        }
      }
    };

    serverProcess.stdout.on('data', data => {
      const text = String(data);
      console.log(text);
      broadcast('out', text);
    });
    serverProcess.stderr.on('data', data => {
      const text = String(data);
      console.error(text);
      broadcast('error', text);
    });
    serverProcess.on('close', code => {
      const msg = `서버 종료: ${code}`;
      console.log(msg);
      broadcast('out', msg);
    });
  }
  setTimeout(() => {
    initServer().catch(error => {
      console.error('Server 초기화 실패:', error);
      if (serverProcess) {
        serverProcess.kill();
      }
      app.quit();
    });
  }, 1000);
  return serverProcess;
}

export function getCurrentServerProcess(): ChildProcess | null {
  return currentServer;
}

export function stopServerProcess(timeoutMs = 3000) {
  return new Promise<void>(resolve => {
    if (!currentServer) return resolve();
    const proc = currentServer;
    currentServer = null;
    try {
      proc.once('close', () => resolve());
      proc.kill();
    } catch {
      resolve();
    }
    setTimeout(() => resolve(), timeoutMs);
  });
}

export async function restartServerProcess() {
  await stopServerProcess();
  await checkJARUpdate();
  await waitForPortFree(SIMULATOR_PORT);
  await runServer();
}
