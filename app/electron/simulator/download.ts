// Download a file into the simulator data directory, showing a progress window.
import path from 'path';
import fs from 'fs';
import { BrowserWindow } from 'electron';
import { staticPage } from '../paths';
import { getSimulatorDataDir } from './paths';

/** The page's scripts get this long to start before the window is shown. */
const PAGE_SETTLE_MS = 200;
/** Progress messages are sent at most this often (and whenever the percentage changes). */
const PROGRESS_INTERVAL_MS = 150;
const CLOSE_AFTER_SUCCESS_MS = 1000;
const CLOSE_AFTER_FAILURE_MS = 3000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** The small window that shows a download's progress (public/progress.html). */
async function openProgressWindow(title: string) {
  const window = new BrowserWindow({
    title,
    width: 400,
    height: 200,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    modal: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    frame: false,
  });
  const loaded = new Promise<void>(resolve => window.webContents.once('did-finish-load', () => resolve()));
  window.loadFile(staticPage('progress.html'));
  await loaded;
  await sleep(PAGE_SETTLE_MS);
  if (!window.isDestroyed()) window.show();

  /** Show a percentage and a message; does nothing once the window is gone. */
  const update = async (percent: number, status: string) => {
    if (window.isDestroyed() || window.webContents.isDestroyed()) return;
    try {
      await window.webContents.executeJavaScript(
        `window.updateProgress?.(${JSON.stringify(percent)}, ${JSON.stringify(status)})`,
      );
    } catch (error) {
      console.warn('Progress update failed:', error);
    }
  };
  const closeAfter = (ms: number) =>
    setTimeout(() => {
      if (!window.isDestroyed()) window.close();
    }, ms);
  return { update, closeAfter };
}

/** Download `url` to `relativePath` in the simulator data directory. Throws if it fails. */
export async function downloadFile(relativePath: string, url: string) {
  // The directory does not exist on a first start on Linux (on Windows and macOS it is
  // Electron's own userData directory, whose name differs only in case).
  fs.mkdirSync(getSimulatorDataDir(), { recursive: true });
  const filePath = path.join(getSimulatorDataDir(), relativePath);
  const progress = await openProgressWindow(`Downloading ${relativePath}`);

  try {
    const response = await fetch(url);
    // An error page (404, 403, rate limit) must not be saved as the file.
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status} (${url})`);
    }
    const totalSize = Number(response.headers.get('content-length') ?? 0);

    const chunks: Uint8Array[] = [];
    let received = 0;
    let lastPercent = -1;
    let lastUpdateAt = 0;
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;

      const percent = totalSize > 0 ? Math.round((received / totalSize) * 100) : 0;
      const now = Date.now();
      if (percent !== lastPercent || now - lastUpdateAt > PROGRESS_INTERVAL_MS) {
        lastPercent = percent;
        lastUpdateAt = now;
        await progress.update(percent, `다운로드 중... ${percent}% (${(received / 1024 / 1024).toFixed(1)}MB)`);
      }
    }

    await progress.update(100, '파일을 저장하는 중...');
    fs.writeFileSync(filePath, Buffer.concat(chunks));
    await progress.update(100, '다운로드 완료!');
    progress.closeAfter(CLOSE_AFTER_SUCCESS_MS);
  } catch (error) {
    console.error('Download failed:', error);
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    await progress.update(0, `다운로드 실패: ${message}`);
    progress.closeAfter(CLOSE_AFTER_FAILURE_MS);
    throw error;
  }
}
