// Locations inside the build output. The main process is bundled into one file
// (dist/main/index.js), so every module sees the same directory here.
import path from 'path';
import { fileURLToPath } from 'url';

const MAIN_DIR = path.dirname(fileURLToPath(import.meta.url));

export const PRELOAD_PATH = path.join(MAIN_DIR, '../preload/index.mjs');

/** A file of the renderer build, e.g. rendererFile('index.html'). */
export function rendererFile(name: string) {
  return path.join(MAIN_DIR, '../renderer', name);
}

/**
 * A static page of public/ (splash.html, progress.html, about.html). The build copies them
 * into the renderer output; `electron-vite dev` builds no renderer output, so there they are
 * read from public/ itself.
 */
export function staticPage(name: string) {
  return process.env['ELECTRON_RENDERER_URL']
    ? path.join(MAIN_DIR, '../../public', name)
    : rendererFile(name);
}
