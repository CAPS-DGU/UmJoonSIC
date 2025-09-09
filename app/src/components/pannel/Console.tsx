import { useEffect } from 'react';
import useConsoleStore from '@/stores/pannel/ConsoleStore';
import { useRunningStore } from '@/stores/RunningStore';

export default function Console() {
  const messages = useConsoleStore(s => s.messages);
  const addMessage = useConsoleStore(s => s.addMessage);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ type: 'out' | 'error'; message: string }>).detail;
      if (!detail) return;
      addMessage({ type: detail.type, message: detail.message });
    };
    window.addEventListener('server-log', handler as EventListener);
    return () => window.removeEventListener('server-log', handler as EventListener);
  }, [messages]);

  const handleRestart = async () => {
    useRunningStore.getState().stopRunning();
    const res = await window.api.restartServer();
    if (res.success) {
      addMessage({ type: 'out', message: 'Server restarted.' });
    } else {
      addMessage({ type: 'error', message: `Restart failed: ${res.message || ''}` });
    }
  };

  return (
    <div className="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col h-full overflow-hidden">
      <div className="font-semibold text-sm p-2 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
        <h2>Server</h2>
        <button
          className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          onClick={handleRestart}
        >
          Restart
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-sm">No output available.</p>
        ) : (
          <ul className=" p-2 space-y-1 bg-gray-50 dark:bg-gray-800 rounded-md">
            {messages.map(msg => (
              <li
                key={msg.id}
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
