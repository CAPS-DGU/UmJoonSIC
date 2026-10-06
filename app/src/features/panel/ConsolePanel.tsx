import { useConsoleStore, type ConsoleLine } from '@/features/panel/consoleStore';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useStrings } from '@/i18n';
import { PANEL_HEADER } from '@/lib/controls';
import { showError } from '@/stores/dialogStore';
import { notify } from '@/stores/toastStore';

/**
 * The colour of a line by what it says, not by the stream it came on: the simulator's web
 * server writes its routine INFO lines to stderr, which made a healthy start look red.
 */
function lineClass(line: ConsoleLine) {
  if (line.type === 'run') return 'font-medium text-blue-700';
  if (
    /\b(SEVERE|ERROR|Exception|FATAL)\b/.test(line.message) ||
    /^(Restart failed|Server stopped)/.test(line.message)
  ) {
    return 'text-red-700';
  }
  if (/\bWARN(ING)?\b/.test(line.message)) return 'text-amber-700';
  if (/\bINFO\b|incoming = \d+ bytes/.test(line.message)) return 'text-gray-600';
  return line.type === 'error' ? 'text-red-700' : 'text-gray-900';
}

/** Simulator tab: the simulator's output, the app's run lines, and a restart button. */
export default function ConsolePanel() {
  const t = useStrings();
  const messages = useConsoleStore(s => s.messages);

  const handleRestart = async () => {
    // Ends a run; if the simulator is down, that only resets the screen, which is fine here.
    await useRunningStore.getState().stopRunning();
    const res = await window.api.restartServer();
    if (res.success) {
      // A new simulator starts in SIC mode without file devices: set up the current ones.
      const { mode, setMode } = useMemoryViewStore.getState();
      setMode(mode);
      notify('success', t.panel.restarted);
    } else {
      void showError(t.panel.restartFailed, res.message);
    }
  };

  return (
    <div className="bg-gray-100 text-gray-900 flex flex-col h-full overflow-hidden">
      <div className={PANEL_HEADER}>
        <span className="text-sm text-gray-700">{t.panel.server}</span>
        <button
          className="inline-flex h-6 items-center rounded border border-gray-300 bg-white px-2 text-xs text-gray-800 hover:bg-gray-50"
          title={t.panel.restartTitle}
          onClick={handleRestart}
        >
          {t.panel.restart}
        </button>
      </div>
      <div className="slim-scroll flex-1 overflow-auto p-2">
        <ul className="space-y-0.5 rounded-md bg-white p-2 font-mono text-xs">
          {messages.map(msg => (
            <li
              key={msg.seq}
              className={`whitespace-pre-wrap [overflow-wrap:anywhere] ${lineClass(msg)}`}
            >
              {msg.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
