import { useConsoleStore } from '@/features/panel/consoleStore';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRunningStore } from '@/features/debugger/runningStore';
import { PANEL_HEADER } from '@/lib/controls';

/** Server tab: simulator output (collected by useServerLog) and a restart button. */
export default function ConsolePanel() {
  const messages = useConsoleStore(s => s.messages);

  // The main process reports the outcome in the output, and in a dialog.
  const handleRestart = async () => {
    // Ends a run; if the simulator is down, that only resets the screen, which is fine here.
    await useRunningStore.getState().stopRunning();
    const res = await window.api.restartServer();
    if (res.success) {
      // A new simulator starts in SIC mode without file devices: set up the current ones.
      const { mode, setMode } = useMemoryViewStore.getState();
      setMode(mode);
    }
  };

  return (
    <div className="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col h-full overflow-hidden">
      <div className={PANEL_HEADER}>
        <h2 className="text-sm font-semibold">Server</h2>
        <button
          className="inline-flex h-6 items-center rounded px-2 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          onClick={handleRestart}
        >
          Restart
        </button>
      </div>
      <div className="slim-scroll flex-1 overflow-auto p-2">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-sm">No output available.</p>
        ) : (
          <ul className=" p-2 space-y-1 bg-gray-50 dark:bg-gray-800 rounded-md">
            {messages.map(msg => (
              <li
                key={msg.seq}
                className={`text-sm ${msg.type === 'error' ? 'text-red-500' : 'text-gray-900 dark:text-gray-200'}`}
              >
                {msg.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
