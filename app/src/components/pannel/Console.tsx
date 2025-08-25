import { useEffect } from 'react';
import useConsoleStore from '@/stores/pannel/ConsoleStore';

export default function Console() {
  const messages = useConsoleStore(s => s.messages);
  const addMessage = useConsoleStore(s => s.addMessage);

  // 더미데이터 생성을 위한 코드로 나중에 useEffect 째로 삭제해버리시면 됩니다.
  useEffect(() => {
    setTimeout(() => {
      for (let i = 0; i < 20; i++) {
        addMessage({ type: 'out', message: '5초 후 메시지' });
        addMessage({ type: 'error', message: '5초 후 에러 메시지' });
      }
    }, 1000);
  }, [addMessage]);

  return (
    <div className="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col h-full overflow-hidden">
      <h2 className="font-semibold text-sm p-2 border-b border-gray-300 dark:border-gray-700">
        Console
      </h2>
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
