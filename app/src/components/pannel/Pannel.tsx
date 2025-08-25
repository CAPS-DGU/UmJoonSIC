import { useState } from 'react';
import WarningPanel from '@/components/pannel/WarningPanel';
import Console from '@/components/pannel/Console';

const TABS = [
  { key: 'watch', label: '관찰' },
  { key: 'warnings', label: '경고' },
  { key: 'console', label: '콘솔' },
];

export default function Pannel() {
  const [activeTab, setActiveTab] = useState<'watch' | 'warnings' | 'console'>('warnings');
  return (
    <div className="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col h-full overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-300 dark:border-gray-700">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'warnings' && <WarningPanel />}
        {activeTab === 'console' && <Console />}
      </div>
    </div>
  );
}
