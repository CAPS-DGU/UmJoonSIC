// Main process entry: application lifecycle.
import { app, BrowserWindow, dialog } from 'electron';
import { electronApp } from '@electron-toolkit/utils';
import { checkUpdate } from './appUpdate';
import { texts } from './i18n';
import { registerIpcHandlers } from './ipc';
import { installMenu } from './menu';
import { applyNativeTheme, onPreferencesChange } from './preferences';
import {
  cancelPendingDispatch,
  findOpenRequestInArgs,
  hasPendingRequest,
  openRequestFor,
  queueOpen,
  sendPendingRequest,
  setInitialRequest,
} from './project/openQueue';
import { closeProgressWindow } from './simulator/download';
import { checkJARUpdate, checkServerExists, downloadServer } from './simulator/jar';
import { checkJreExists, downloadJre } from './simulator/jre';
import { simulatorProcess } from './simulator/process';
import { createMainWindow, getMainWindow, noteQuitRequested } from './windows/mainWindow';
import { createSplashWindow, setSplashStatus, showSplashContent } from './windows/splashWindow';

/** The splash stays up at least this long once the simulator is being started. */
const SPLASH_HOLD_MS = 3000;
/** How long a failed start's message stays on the splash before the error box. */
const SPLASH_FAILURE_MS = 1500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

app.setName('UmJoonSIC');
registerIpcHandlers();

/** Make sure a JRE and simulator.jar are present and current. Throws if either is missing. */
async function prepareSimulator() {
  await checkUpdate();
  const t = texts();

  // One progress window for the whole preparation: "(1/2) the Java runtime", "(2/2) …".
  const needJre = !checkJreExists();
  const needJar = !checkServerExists();
  const total = Number(needJre) + Number(needJar);
  let index = 0;
  let failure: unknown = null;
  if (needJre) {
    await downloadJre({ index: ++index, total, label: t.downloadJre }).catch(error => {
      console.error('JRE download failed:', error);
      failure = error;
    });
  }
  if (needJar && !failure) {
    await downloadServer({ index: ++index, total, label: t.downloadSimulator }).catch(error => {
      console.error('simulator.jar download failed:', error);
      failure = error;
    });
  }
  if (!failure) await checkJARUpdate();
  closeProgressWindow();

  if (!checkJreExists() || !checkServerExists()) {
    const detail = failure instanceof Error ? failure.message : '';
    throw new Error(detail ? `${t.notPrepared}\n(${detail})` : t.notPrepared);
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
      void setSplashStatus({ heading: '', detail: texts().startingSimulator, failed: false });
      await Promise.all([simulatorProcess.start(), sleep(SPLASH_HOLD_MS)]);
    } catch (error) {
      // Stopped by the quit, not a failure.
      if (cancelled) return;
      // The error box comes alone (destroy() does not count as the user closing the splash).
      // A message box, not showErrorBox: it does not block the main process, and its title
      // and button follow the interface language.
      // The failure stays on the splash a moment, so that it is seen before the error box.
      if (!splash.isDestroyed()) await sleep(SPLASH_FAILURE_MS);
      closeProgressWindow();
      if (!splash.isDestroyed()) splash.destroy();
      const t = texts();
      await dialog.showMessageBox({
        type: 'error',
        title: t.simulatorErrorTitle,
        message: t.simulatorErrorMessage,
        detail: t.simulatorErrorDetail(error instanceof Error ? error.message : String(error)),
        buttons: [t.ok],
        defaultId: 0,
        noLink: true,
      });
      app.quit();
      return;
    }
    if (cancelled) return;
    started = true;
    // The main window first, then the splash goes: never a moment without a window.
    getMainWindow()?.show();
    if (!splash.isDestroyed()) {
      splash.close();
    }
  });

  mainWindow.webContents.on('did-finish-load', sendPendingRequest);
  mainWindow.on('closed', cancelPendingDispatch);
}

// Only one instance runs. A second start hands its project.sic (if any) to the first and exits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // A project.sic or an assembly file to open (double-click, "Open with", command line).
  const initialRequest = findOpenRequestInArgs(process.argv);
  if (initialRequest) {
    setInitialRequest(initialRequest);
  }

  app.on('second-instance', (_event, commandLine) => {
    const request = findOpenRequestInArgs(commandLine);
    if (request) {
      queueOpen(request);
    } else {
      // Started again without a file: show the window that is already there.
      const mainWindow = getMainWindow();
      if (mainWindow?.isMinimized()) mainWindow.restore();
      mainWindow?.focus();
    }
  });

  // macOS delivers opened files through this event, not through argv.
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    const request = openRequestFor(filePath);
    if (request) queueOpen(request);
  });

  app.whenReady().then(() => {
    // Windows: application user model id (taskbar grouping, notifications).
    electronApp.setAppUserModelId('com.electron');

    applyNativeTheme();
    installMenu();
    // The menu is in the interface language and shows the chosen language and theme.
    onPreferencesChange(() => installMenu());

    // @electron-toolkit's optimizer.watchWindowShortcuts is deliberately not used:
    // it interfered with the zoom shortcuts.

    createWindow();

    if (hasPendingRequest()) {
      queueOpen();
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
