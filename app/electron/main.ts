import {
  app,
  shell,
  BrowserWindow,
  Menu,
  type HandlerDetails,
  type Event as ElectronEvent,
  type MenuItemConstructorOptions,
} from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { menuList } from './menu';
import './ipc/file';
import './ipc/server';
import type { ChildProcess } from 'child_process';
import {
  checkJreExists,
  checkServerExists,
  checkUpdate,
  downloadJre,
  downloadServer,
  runServer,
  checkJARUpdate,
} from './setup';

let server: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let pendingProjectSicPath: string | null = null;
let dispatchRetryTimer: NodeJS.Timeout | null = null;
app.setName('UmJoonSIC');

const gotSingleInstanceLock = app.requestSingleInstanceLock();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findSicPathInArgs(argv: string[]): string | null {
  for (let i = 1; i < argv.length; i++) {
    const rawArg = argv[i];
    if (!rawArg) continue;
    const cleaned = rawArg.replace(/^['"]|['"]$/g, '');
    if (!cleaned.toLowerCase().endsWith('.sic')) continue;
    const resolved = path.resolve(cleaned);
    if (fs.existsSync(resolved)) {
      console.log('[UmJoonSIC] Detected project.sic argument:', resolved);
      return resolved;
    }
    console.warn('[UmJoonSIC] project.sic argument found but file missing:', resolved);
  }
  return null;
}

function sendPendingProjectPath() {
  if (!mainWindow || !pendingProjectSicPath) return;
  if (mainWindow.webContents.isLoadingMainFrame()) {
    console.log('[UmJoonSIC] Renderer still loading, deferring project dispatch');
    if (!dispatchRetryTimer) {
      dispatchRetryTimer = setTimeout(() => {
        dispatchRetryTimer = null;
        sendPendingProjectPath();
      }, 250);
    }
    return;
  }
  if (!fs.existsSync(pendingProjectSicPath)) {
    console.warn('Requested project.sic file no longer exists:', pendingProjectSicPath);
    pendingProjectSicPath = null;
    return;
  }
  mainWindow.webContents.send('open-project-path', pendingProjectSicPath);
  console.log('[UmJoonSIC] Dispatched project.sic path to renderer:', pendingProjectSicPath);
  pendingProjectSicPath = null;
  if (dispatchRetryTimer) {
    clearTimeout(dispatchRetryTimer);
    dispatchRetryTimer = null;
  }
}

function queueProjectOpen(inputPath: string | null) {
  if (!inputPath) return;
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    console.warn('Requested project.sic file not found:', resolved);
    return;
  }
  pendingProjectSicPath = resolved;
  if (mainWindow) {
    sendPendingProjectPath();
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
}

function createWindow(): void {
  // Create the browser window.
  const preloadPath = path.join(__dirname, '../preload/index.mjs');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 640,
    show: false,
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? {} : {}), // app-icon
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: true,
    },
  });

  const splash = new BrowserWindow({
    width: 600,
    height: 400,
    autoHideMenuBar: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    maximizable: false,
  });

  mainWindow.on('ready-to-show', async () => {
    splash.loadFile(path.join(__dirname, '../renderer/splash.html'));
    splash.center();

    await checkUpdate();

    if (!checkJreExists()) {
      await downloadJre().catch(error => {
        console.error('JRE 다운로드 실패:', error);
      });
      console.log('jre 다운로드');
    }
    if (!checkServerExists()) {
      await downloadServer().catch(error => {
        console.error('Server 다운로드 실패:', error);
      });
      console.log('server 다운로드');
    }

    await checkJARUpdate();

    server = await runServer();

    setTimeout(() => {
      if (!splash.isDestroyed()) {
        splash.close();
      }
      mainWindow?.show();
    }, 3000);
  });

  mainWindow.webContents.setWindowOpenHandler((details: HandlerDetails) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', sendPendingProjectPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (dispatchRetryTimer) {
      clearTimeout(dispatchRetryTimer);
      dispatchRetryTimer = null;
    }
  });

  // HMR for renderer based on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  const initialSicPath = findSicPathInArgs(process.argv);
  if (initialSicPath) {
    pendingProjectSicPath = initialSicPath;
    console.log('[UmJoonSIC] Queued initial project.sic path:', initialSicPath);
  }

  app.on('second-instance', (_event: ElectronEvent, commandLine: string[]) => {
    const sicPath = findSicPathInArgs(commandLine);
    if (sicPath) {
      queueProjectOpen(sicPath);
    }
  });

  app.on('open-file', (event: ElectronEvent, filePath: string) => {
    event.preventDefault();
    queueProjectOpen(filePath);
    console.log('[UmJoonSIC] Received open-file event for:', filePath);
  });

  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron');

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuList as MenuItemConstructorOptions[]));

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_event: ElectronEvent, _window: BrowserWindow) => {
      // optimizer.watchWindowShortcuts(window); // 줌 단축키 문제로 임시 비활성화
    });

    createWindow();

    if (pendingProjectSicPath) {
      queueProjectOpen(pendingProjectSicPath);
    }

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
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
