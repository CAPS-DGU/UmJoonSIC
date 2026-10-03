import { useEffect } from 'react';
import { AppEvent, type ServerLogPayload } from '@shared/ipc';
import { useConsoleStore } from '@/features/panel/consoleStore';

/**
 * Collect the simulator's output for the Server tab, whether or not that tab is open:
 * what the main process recorded before this window was listening, then every new chunk.
 */
export function useServerLog() {
  const addMessages = useConsoleStore(s => s.addMessages);

  useEffect(() => {
    const handler = (event: Event) => {
      const payload = (event as CustomEvent<ServerLogPayload>).detail;
      if (payload) {
        addMessages([payload]);
      }
    };
    window.addEventListener(AppEvent.serverLog, handler);
    // Listening first, then the history: a chunk in both is stored once (same seq).
    window.api.getServerLog().then(res => {
      if (res.success && res.data) {
        addMessages(res.data);
      }
    });
    return () => window.removeEventListener(AppEvent.serverLog, handler);
  }, [addMessages]);
}
