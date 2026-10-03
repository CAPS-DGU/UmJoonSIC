import { registerFileHandlers } from './files';
import { registerProjectHandlers } from './project';
import { registerServerHandlers } from './server';

/** Register every `window.api` request handler. Call once, before the renderer loads. */
export function registerIpcHandlers() {
  registerProjectHandlers();
  registerFileHandlers();
  registerServerHandlers();
}
