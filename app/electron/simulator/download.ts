// Download files into the simulator data directory, showing their progress in one window
// for the whole preparation (the JRE, then simulator.jar).
import path from 'path';
import fs from 'fs';
import { BrowserWindow } from 'electron';
import { texts } from '../i18n';
import { staticPage } from '../paths';
import { getPreferences } from '../preferences';
import { getSplashWindow } from '../windows/splashWindow';
import { getSimulatorDataDir } from './paths';

/** Progress messages are sent at most this often (and whenever the percentage changes). */
const PROGRESS_INTERVAL_MS = 150;

interface ProgressState {
  heading?: string;
  percent?: number;
  status?: string;
  failed?: boolean;
}

let progressWindow: BrowserWindow | null = null;
let shown: Promise<void> | null = null;

/**
 * The progress window (public/progress.html), opened at the first download and kept for the
 * next one. It belongs to the splash: in front of it, not in front of other programs.
 */
function openProgressWindow(title: string) {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.setTitle(title);
    return shown!;
  }
  const { theme } = getPreferences();
  progressWindow = new BrowserWindow({
    title,
    parent: getSplashWindow() ?? undefined,
    width: 400,
    height: 132,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    modal: false,
    autoHideMenuBar: true,
    frame: false,
    backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
  });
  const window = progressWindow;
  window.on('closed', () => {
    if (progressWindow === window) progressWindow = null;
  });
  // Shown by the first setProgress, with its text: shown at load, it was a blank card first.
  shown = new Promise<void>(resolve => {
    window.webContents.once('did-finish-load', () => resolve());
  });
  void window.loadFile(staticPage('progress.html'), { query: { theme } });
  return shown;
}

async function setProgress(state: ProgressState) {
  const window = progressWindow;
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
  try {
    await window.webContents.executeJavaScript(`window.setProgress?.(${JSON.stringify(state)})`);
    if (!window.isDestroyed() && !window.isVisible()) window.show();
  } catch (error) {
    console.warn('Progress update failed:', error);
  }
}

/** Close the progress window (all downloads are done, or one failed and an error box follows). */
export function closeProgressWindow() {
  if (progressWindow && !progressWindow.isDestroyed()) progressWindow.close();
  progressWindow = null;
}

/** One file of the preparation: its place in the sequence and what it is. */
export interface DownloadStep {
  index: number;
  total: number;
  /** What is being downloaded, in words ("the Java runtime"). */
  label: string;
}

/** Download `url` to `relativePath` in the simulator data directory. Throws if it fails. */
export async function downloadFile(relativePath: string, url: string, step: DownloadStep) {
  const t = texts();
  // The directory does not exist on a first start on Linux (on Windows and macOS it is
  // Electron's own userData directory, whose name differs only in case).
  fs.mkdirSync(getSimulatorDataDir(), { recursive: true });
  const filePath = path.join(getSimulatorDataDir(), relativePath);
  await openProgressWindow(`UmJoonSIC — ${relativePath}`);
  const heading = t.downloadHeading(step.index, step.total);
  await setProgress({ heading, percent: 0, status: step.label, failed: false });

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
        await setProgress({
          percent,
          status: `${step.label} ${t.downloadProgress(percent, (received / 1024 / 1024).toFixed(1))}`,
        });
      }
    }

    await setProgress({ percent: 100, status: `${step.label} ${t.downloadSaving}` });
    fs.writeFileSync(filePath, Buffer.concat(chunks));
    await setProgress({ percent: 100, status: `${step.label} ${t.downloadDone}` });
  } catch (error) {
    console.error('Download failed:', error);
    const reason = error instanceof Error ? error.message : t.unknownError;
    // The heading says it failed too (it said "preparing" while the status said "failed").
    await setProgress({ heading: t.downloadFailedHeading, status: t.downloadFailed(reason), failed: true });
    throw error;
  }
}
