import { app, shell, BrowserWindow, Menu } from 'electron';
const path = require('node:path');
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { menuList } from './menu';
import './ipc/file';
import './ipc/server';

function createWindow(): void {
  // Create the browser window.
  const preloadPath = path.join(__dirname, '../preload/index.mjs');
  const mainWindow = new BrowserWindow({
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
    width: 500,
    height: 300,
    autoHideMenuBar: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    maximizable: false,
  });

  mainWindow.on('ready-to-show', () => {
    splash.loadFile(path.join(__dirname, '../renderer/splash.html'));
    splash.center();
    setTimeout(() => {
      splash.close();
      mainWindow.show();
    }, 3000);
  });

  mainWindow.webContents.setWindowOpenHandler(details => {
    shell.openExternal(details.url);
    return { action: 'deny' };
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
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuList));

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
