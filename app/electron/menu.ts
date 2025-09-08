// electron/menu.ts
import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

export const menuList = [
  {
    label: 'Application',
    submenu: [
      {
        label: 'About UmJoonSIC',
        click: () => {
          const aboutWindow = new BrowserWindow({
            width: 400,
            height: 200,
            resizable: false,
            autoHideMenuBar: true,
            title: 'About UmJoonSIC',
            modal: true,
            parent: BrowserWindow.getFocusedWindow() ?? undefined,
          });

          aboutWindow.loadFile(path.join(app.getAppPath(), 'public/about.html'));

          aboutWindow.webContents.on('will-navigate', (e, url) => {
            e.preventDefault();
            shell.openExternal(url);
          });
        },
      },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'services' },
      { role: 'quit' },
    ],
  },
  {
    label: 'File',
    submenu: [
      {
        label: 'New Project',
        click: () => {
          const { BrowserWindow } = require('electron');
          const windows = BrowserWindow.getAllWindows();
          windows.forEach(window => {
            window.webContents.send('create-new-project');
          });
        },
      },
      {
        label: 'Open Project',
        click: () => {
          const { BrowserWindow } = require('electron');
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((window: any) => {
            window.webContents.send('open-project');
          });
        },
      },
      {
        label: 'Close Project',
        click: () => {
          console.log('Close Project');
          const { BrowserWindow } = require('electron');
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((window: any) => {
            window.webContents.send('close-project');
          });
        },
      },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
  {
    label: 'Window',
    submenu: [{ role: 'minimize' }, { role: 'close' }],
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'How to use',
        click: async () => {
          await shell.openExternal(
            'https://radical-potential-27c.notion.site/How-to-use-UmJoonSIC-267b7ce7932f80d799f0f6b0a11c0bd9?source=copy_link',
          );
        },
      },
    ],
  },
];
