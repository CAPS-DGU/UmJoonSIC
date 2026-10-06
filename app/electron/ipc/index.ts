import { registerFileHandlers } from './files';
import { registerPreferenceHandlers } from './preferences';
import { registerProjectHandlers } from './project';
import { registerServerHandlers } from './server';
import { registerWindowHandlers } from './window';

/** Register every `window.api` request handler. Call once, before the renderer loads. */
export function registerIpcHandlers() {
  registerProjectHandlers();
  registerFileHandlers();
  registerServerHandlers();
  registerWindowHandlers();
  registerPreferenceHandlers();
}
