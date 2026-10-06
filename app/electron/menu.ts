import { BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { AppEvent } from '../shared/ipc';
import { texts } from './i18n';
import { getPreferences, setPreferences } from './preferences';
import { openAboutWindow } from './windows/aboutWindow';
import { getMainWindow } from './windows/mainWindow';

const HOW_TO_USE_URL =
  'https://radical-potential-27c.notion.site/How-to-use-UmJoonSIC-267b7ce7932f80d799f0f6b0a11c0bd9?source=copy_link';

const isDevtoolsEnabled = process.env.SHOW_DEVTOOLS === 'true';
const isMac = process.platform === 'darwin';

/** The step intervals offered in Run > Step Interval (ms). */
export const RUN_INTERVALS_MS = [0, 10, 50, 100, 250, 500, 1000];

/** Commands are carried out by the main window's page; the menu only announces them. */
function sendToMainWindow(event: string, payload?: unknown) {
  getMainWindow()?.webContents.send(event, payload);
}

/** A command for the main window (another window, such as About, does not take it). */
const mainWindowCommand = (
  label: string,
  accelerator: string | undefined,
  event: string,
  payload?: unknown,
): MenuItemConstructorOptions => ({
  label,
  accelerator,
  click: (_item, focusedWindow) => {
    const mainWindow = getMainWindow();
    if (focusedWindow && focusedWindow !== mainWindow) return;
    sendToMainWindow(event, payload);
  },
});

/** The application menu in the current interface language. */
export function buildMenuTemplate(): MenuItemConstructorOptions[] {
  const t = texts();
  const { language, theme } = getPreferences();
  const devToolsItems: MenuItemConstructorOptions[] = isDevtoolsEnabled
    ? [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
      ]
    : [];

  return [
    {
      label: t.menuApp,
      submenu: [
        { label: t.about, click: openAboutWindow },
        // Hide, Hide Others, Show All and Services exist only on macOS.
        ...(isMac
          ? ([
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'services' },
            ] as MenuItemConstructorOptions[])
          : []),
        { type: 'separator' },
        { role: 'quit', label: t.quit },
      ],
    },
    {
      label: t.menuFile,
      submenu: [
        mainWindowCommand(t.newProject, 'CmdOrCtrl+Shift+N', AppEvent.createNewProject),
        mainWindowCommand(t.openProject, 'CmdOrCtrl+O', AppEvent.openProject),
        mainWindowCommand(t.closeProject, undefined, AppEvent.closeProject),
        { type: 'separator' },
        mainWindowCommand(t.newFile, 'CmdOrCtrl+N', AppEvent.newFile),
        {
          label: t.closeTab,
          accelerator: 'CmdOrCtrl+W',
          // In another window (About), the shortcut closes that window.
          click: (_item, focusedWindow) => {
            const mainWindow = getMainWindow();
            if (focusedWindow && focusedWindow !== mainWindow) {
              focusedWindow.close();
            } else {
              mainWindow?.webContents.send(AppEvent.closeActiveTab);
            }
          },
        },
        // Ctrl, also on macOS, where Cmd+PageDown scrolls the editor (setupMonaco.ts frees
        // Ctrl). Ctrl+Tab and Ctrl+Shift+Tab work too (mainWindow.ts).
        mainWindowCommand(t.nextTab, 'Ctrl+PageDown', AppEvent.nextTab),
        mainWindowCommand(t.previousTab, 'Ctrl+PageUp', AppEvent.previousTab),
        mainWindowCommand(t.moveTabRight, 'Ctrl+Shift+PageDown', AppEvent.moveTabRight),
        mainWindowCommand(t.moveTabLeft, 'Ctrl+Shift+PageUp', AppEvent.moveTabLeft),
      ],
    },
    {
      label: t.menuEdit,
      submenu: [
        { role: 'undo', label: t.undo },
        { role: 'redo', label: t.redo },
        { type: 'separator' },
        { role: 'cut', label: t.cut },
        { role: 'copy', label: t.copy },
        { role: 'paste', label: t.paste },
        { role: 'selectAll', label: t.selectAll },
      ],
    },
    {
      label: t.menuView,
      submenu: [
        ...devToolsItems,
        { role: 'resetZoom', label: t.actualSize },
        // Ctrl+= and Ctrl+numpad + zoom in too (mainWindow.ts).
        { role: 'zoomIn', label: t.zoomIn },
        { role: 'zoomOut', label: t.zoomOut },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t.fullScreen },
        { type: 'separator' },
        {
          label: t.language,
          submenu: [
            {
              label: '한국어',
              type: 'radio',
              checked: language === 'ko',
              click: () => setPreferences({ language: 'ko' }),
            },
            {
              label: 'English',
              type: 'radio',
              checked: language === 'en',
              click: () => setPreferences({ language: 'en' }),
            },
          ],
        },
        {
          label: t.theme,
          submenu: [
            {
              label: t.themeLight,
              type: 'radio',
              checked: theme === 'light',
              click: () => setPreferences({ theme: 'light' }),
            },
            {
              label: t.themeDark,
              type: 'radio',
              checked: theme === 'dark',
              click: () => setPreferences({ theme: 'dark' }),
            },
          ],
        },
      ],
    },
    {
      label: t.menuRun,
      submenu: [
        mainWindowCommand(t.runStart, 'F5', AppEvent.runStart),
        mainWindowCommand(t.runPause, 'F6', AppEvent.runPause),
        mainWindowCommand(t.runStep, 'F10', AppEvent.runStep),
        mainWindowCommand(t.runRestart, 'CmdOrCtrl+Shift+F5', AppEvent.runRestart),
        mainWindowCommand(t.runStop, 'Shift+F5', AppEvent.runStop),
        { type: 'separator' },
        {
          label: t.runInterval,
          submenu: RUN_INTERVALS_MS.map(ms =>
            mainWindowCommand(
              ms === 0 ? t.intervalFastest : `${ms} ms`,
              undefined,
              AppEvent.runInterval,
              ms,
            ),
          ),
        },
      ],
    },
    {
      label: t.menuWindow,
      // Not role 'close': its Ctrl+W shortcut closed the window (and quit the app) when a
      // tab was meant. The window still closes with its close button or Alt+F4.
      submenu: [
        // Ctrl+M stays the editor's "Tab moves focus" (Monaco, as in VS Code); macOS keeps Cmd+M.
        isMac
          ? { role: 'minimize', label: t.minimize }
          : { label: t.minimize, click: () => BrowserWindow.getFocusedWindow()?.minimize() },
        { label: t.closeWindow, click: () => BrowserWindow.getFocusedWindow()?.close() },
      ],
    },
    {
      label: t.menuHelp,
      submenu: [{ label: t.howToUse, click: () => shell.openExternal(HOW_TO_USE_URL) }],
    },
  ];
}

/** Build and set the application menu (again after the language or theme changed). */
export function installMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate()));
}
