// Main process entry: application lifecycle.
import { app, BrowserWindow, dialog, Menu } from 'electron';
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
import { simulatorProcess } from './simulator/process';
import { createMainWindow, getMainWindow, noteQuitRequested } from './windows/mainWindow';
import { createSplashWindow, showSplashContent } from './windows/splashWindow';

/** The splash stays up at least this long once the simulator is being started. */
const SPLASH_HOLD_MS = 3000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

app.setName('UmJoonSIC');
registerIpcHandlers();

/** Make sure a JRE and simulator.jar are present and current. Throws if either is missing. */
async function prepareSimulator() {
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

  if (!checkJreExists() || !checkServerExists()) {
    throw new Error(
      'Java 실행 환경 또는 simulator.jar 를 준비하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 실행하세요.',
    );
  }
}

function createWindow(): void {
  const mainWindow = createMainWindow();
  const splash = createSplashWindow();

  // Closing the splash (its close button in the taskbar, Alt+F4) cancels the start: the app
  // quits, and does not show its main window later on.
  let started = false;
  let cancelled = false;
  splash.on('close', () => {
    if (started) return;
    cancelled = true;
    app.quit();
  });

  mainWindow.on('ready-to-show', async () => {
    if (cancelled) return;
    showSplashContent(splash);
    try {
      await prepareSimulator();
      await Promise.all([simulatorProcess.start(), sleep(SPLASH_HOLD_MS)]);
    } catch (error) {
      // Stopped by the quit, not a failure.
      if (cancelled) return;
      // The error box comes alone (destroy() does not count as the user closing the splash).
      if (!splash.isDestroyed()) splash.destroy();
      dialog.showErrorBox(
        '시뮬레이터 오류',
        `시뮬레이터를 시작하지 못해 앱을 종료합니다.\n${error instanceof Error ? error.message : String(error)}`,
      );
      app.quit();
      return;
    }
    if (cancelled) return;
    started = true;
    if (!splash.isDestroyed()) {
      splash.close();
    }
    getMainWindow()?.show();
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
    app.quit();
  }
});

app.on('before-quit', noteQuitRequested);

// Stop the current simulator, including one restarted from the Server panel.
app.on('will-quit', () => {
  simulatorProcess.kill();
});
