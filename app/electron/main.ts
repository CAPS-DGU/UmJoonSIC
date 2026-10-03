// Main process entry: application lifecycle.
import { app, BrowserWindow, Menu } from 'electron';
import type { ChildProcess } from 'child_process';
import { electronApp } from '@electron-toolkit/utils';
import { checkUpdate } from './appUpdate';
import { registerIpcHandlers } from './ipc';
import { menuList } from './menu';
import {
  cancelPendingDispatch,
  findSicPathInArgs,
  hasPendingProjectPath,
  queueProjectOpen,
  sendPendingProjectPath,
  setInitialProjectPath,
} from './project/openQueue';
import { checkJARUpdate, checkServerExists, downloadServer } from './simulator/jar';
import { checkJreExists, downloadJre } from './simulator/jre';
import { runServer } from './simulator/process';
import { createMainWindow, getMainWindow } from './windows/mainWindow';
import { createSplashWindow, showSplashContent } from './windows/splashWindow';

/** How long the splash stays up after the simulator has started. */
const SPLASH_HOLD_MS = 3000;

// The simulator started at launch. NOTE: a simulator restarted from the Server panel is
// tracked in simulator/process.ts, not here, so quitting does not kill that one.
let server: ChildProcess | null = null;

app.setName('UmJoonSIC');
registerIpcHandlers();

/** Make sure a JRE and simulator.jar are present and current, then start the simulator. */
async function startSimulator(): Promise<ChildProcess> {
  await checkUpdate();

  if (!checkJreExists()) {
    await downloadJre().catch(error => {
      console.error('JRE 다운로드 실패:', error);
    });
  }
  if (!checkServerExists()) {
    await downloadServer().catch(error => {
      console.error('Server 다운로드 실패:', error);
    });
  }
  await checkJARUpdate();

  return runServer();
}

function createWindow(): void {
  const mainWindow = createMainWindow();
  const splash = createSplashWindow();

  mainWindow.on('ready-to-show', async () => {
    showSplashContent(splash);
    server = await startSimulator();

    setTimeout(() => {
      // The user may have closed the splash already.
      if (!splash.isDestroyed()) {
        splash.close();
      }
      getMainWindow()?.show();
    }, SPLASH_HOLD_MS);
  });

  mainWindow.webContents.on('did-finish-load', sendPendingProjectPath);
  mainWindow.on('closed', cancelPendingDispatch);
}

// Only one instance runs. A second start hands its project.sic (if any) to the first and exits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const initialSicPath = findSicPathInArgs(process.argv);
  if (initialSicPath) {
    setInitialProjectPath(initialSicPath);
  }

  app.on('second-instance', (_event, commandLine) => {
    const sicPath = findSicPathInArgs(commandLine);
    if (sicPath) {
      queueProjectOpen(sicPath);
    }
  });

  // macOS delivers opened files through this event, not through argv.
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    queueProjectOpen(filePath);
  });

  app.whenReady().then(() => {
    // Windows: application user model id (taskbar grouping, notifications).
    electronApp.setAppUserModelId('com.electron');

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuList));

    // @electron-toolkit's optimizer.watchWindowShortcuts is deliberately not used:
    // it interfered with the zoom shortcuts.

    createWindow();

    if (hasPendingProjectPath()) {
      queueProjectOpen();
    }

    app.on('activate', () => {
      // macOS: re-create the window when the dock icon is clicked and none is open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// Quit when all windows are closed, except on macOS, where applications stay
// active until the user quits explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (server) {
      server.kill();
    }
    app.quit();
  }
});

app.on('will-quit', () => {
  if (server) {
    server.kill();
  }
});
