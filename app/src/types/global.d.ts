import type { RendererApi } from '@shared/ipc';

declare global {
  interface Window {
    /** Exposed by electron/preload.ts. */
    api: RendererApi;
  }
}
