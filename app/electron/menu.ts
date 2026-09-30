import { BrowserWindow, shell, type MenuItemConstructorOptions } from 'electron';
import { AppEvent } from '../shared/ipc';
import { openAboutWindow } from './windows/aboutWindow';

const HOW_TO_USE_URL =
  'https://radical-potential-27c.notion.site/How-to-use-UmJoonSIC-267b7ce7932f80d799f0f6b0a11c0bd9?source=copy_link';

const isDevtoolsEnabled = process.env.SHOW_DEVTOOLS === 'true';

/** Project commands are carried out by the renderer; the menu only announces them. */
function sendToAllWindows(event: string) {
  BrowserWindow.getAllWindows().forEach(window => window.webContents.send(event));
}

const devToolsItems: MenuItemConstructorOptions[] = isDevtoolsEnabled
  ? [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }]
  : [];

export const menuList: MenuItemConstructorOptions[] = [
  {
    label: 'Application',
    submenu: [
      { label: 'About UmJoonSIC', click: openAboutWindow },
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
      { label: 'New Project', click: () => sendToAllWindows(AppEvent.createNewProject) },
      { label: 'Open Project', click: () => sendToAllWindows(AppEvent.openProject) },
      { label: 'Close Project', click: () => sendToAllWindows(AppEvent.closeProject) },
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
      ...devToolsItems,
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
    submenu: [{ label: 'How to use', click: () => shell.openExternal(HOW_TO_USE_URL) }],
  },
];
