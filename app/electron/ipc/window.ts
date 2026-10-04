// IPC: closing the main window with unsaved changes, and the question asked about them.
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { IpcChannel, type UnsavedChangesChoice } from '../../shared/ipc';
import {
  allowMainWindowClose,
  cancelMainWindowClose,
  noteAsking,
  setHasUnsavedChanges,
} from '../windows/mainWindow';
import { ipcResult } from './result';

const CHOICES: UnsavedChangesChoice[] = ['save', 'discard', 'cancel'];

export function registerWindowHandlers() {
  ipcMain.on(IpcChannel.setHasUnsavedChanges, (_event, hasUnsavedChanges: boolean) => {
    setHasUnsavedChanges(hasUnsavedChanges);
  });

  ipcMain.handle(IpcChannel.confirmUnsavedChanges, (event, fileNames: string[]) =>
    ipcResult(async () => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const options = {
        type: 'warning' as const,
        title: '저장하지 않은 변경 사항',
        message:
          fileNames.length === 1
            ? `'${fileNames[0]}'의 변경 사항을 저장할까요?`
            : `저장하지 않은 파일 ${fileNames.length}개의 변경 사항을 저장할까요?`,
        detail: `${fileNames.join('\n')}\n\n저장하지 않으면 변경 사항이 사라집니다.`,
        buttons: ['저장', '저장 안 함', '취소'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      };
      noteAsking(true);
      try {
        const { response } = window
          ? await dialog.showMessageBox(window, options)
          : await dialog.showMessageBox(options);
        return CHOICES[response] ?? 'cancel';
      } finally {
        noteAsking(false);
      }
    }),
  );

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
