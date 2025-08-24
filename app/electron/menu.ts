// electron/menu.ts
import { shell } from 'electron';

export const menuList = [
  {
    label: 'Application',
    submenu: [
      { role: 'about' },
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
          // 모든 브라우저 윈도우에 새 프로젝트 생성 이벤트 전송
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
        label: 'Open Recent',
        submenu: [{ role: 'clearRecentDocuments' }, { role: 'recentDocuments' }],
      },
      {
        label: 'Close Project',
        click: () => {
          console.log('Close Project');
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
        label: 'Learn More',
        click: async () => {
          await shell.openExternal('https://www.dongguk.edu/');
        },
      },
    ],
  },
];
