// IPC: closing the main window with unsaved changes (the page asks the user).
import { app, ipcMain } from 'electron';
import { IpcChannel } from '../../shared/ipc';
import {
  allowMainWindowClose,
  cancelMainWindowClose,
  noteAsking,
  setHasUnsavedChanges,
} from '../windows/mainWindow';
import { ipcResult } from './result';

export function registerWindowHandlers() {
  ipcMain.on(IpcChannel.setHasUnsavedChanges, (_event, hasUnsavedChanges: boolean) => {
    setHasUnsavedChanges(hasUnsavedChanges);
  });

  // The page asks about unsaved changes in its own dialog; meanwhile a close waits.
  ipcMain.on(IpcChannel.setAsking, (_event, asking: boolean) => noteAsking(!!asking));

  // The user cancelled closing (or a save failed): the window stays.
  ipcMain.on(IpcChannel.abortClose, () => cancelMainWindowClose());

  // The renderer has dealt with the unsaved changes: close for real (and finish a quit).
  ipcMain.handle(IpcChannel.closeWindow, () =>
    ipcResult(() => {
      if (allowMainWindowClose()) {
        app.quit();
      }
    }),
  );
}
