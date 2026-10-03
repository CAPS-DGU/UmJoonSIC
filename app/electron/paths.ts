// Locations inside the build output. The main process is bundled into one file
// (dist/main/index.js), so every module sees the same directory here.
import path from 'path';
import { fileURLToPath } from 'url';

const MAIN_DIR = path.dirname(fileURLToPath(import.meta.url));

export const PRELOAD_PATH = path.join(MAIN_DIR, '../preload/index.mjs');

/** A file of the renderer build, e.g. rendererFile('splash.html'). */
export function rendererFile(name: string) {
  return path.join(MAIN_DIR, '../renderer', name);
}
