import { useState } from 'react';
import WatchPanel from '@/features/panel/WatchPanel';
import ErrorPanel from '@/features/panel/ErrorPanel';
import ConsolePanel from '@/features/panel/ConsolePanel';

const TABS = [
  { key: 'watch', label: '관찰' },
  { key: 'errors', label: '오류' },
  { key: 'server', label: '서버' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** The panel under the editor: Watch, Errors and Server tabs. */
export default function BottomPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>('errors');

  return (
    <div className="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-gray-300 dark:border-gray-700">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-2 text-sm font-medium transition-colors flex justify-center items-center rounded-t ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-gray-200 dark:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent p-2">
        <div className={`flex-1 transition-opacity duration-200`}>
          {activeTab === 'watch' && <WatchPanel />}
          {activeTab === 'errors' && <ErrorPanel />}
          {activeTab === 'server' && <ConsolePanel />}
        </div>
      </div>
    </div>
  );
}
