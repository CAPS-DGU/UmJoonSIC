import { useEditorTabStore } from '@/stores/EditorTabStore';
import { File, X, Settings } from 'lucide-react';

export default function TabBar() {
  const { tabs, closeTab, setActiveTab } = useEditorTabStore();

  const getFileIcon = (fileName: string) => {
    if (fileName.toLowerCase() === 'project.sic') {
      return <Settings width={14} height={14} className="text-blue-500" />;
    }
    if (fileName.toLowerCase().endsWith('.asm')) {
      return <File width={14} height={14} className="text-green-500" />;
    }
    return <File width={14} height={14} className="text-gray-500" />;
  };

  return (
    <div className="flex flex-row bg-white border-b border-gray-300 overflow-x-auto">
      {tabs.map(tab => (
        <div
          key={tab.filePath}
          className={`flex items-center min-w-0 max-w-48 border-r border-gray-300 ${
            tab.isActive 
              ? 'bg-gray-200 border-b-0' 
              : 'bg-gray-50 hover:bg-gray-200'
          }`}
        >
          <button
            onClick={() => setActiveTab(tab.idx)}
            className="flex items-center gap-1 px-3 py-2 min-w-0 flex-1 hover:bg-gray-100 transition-colors"
          >
            {getFileIcon(tab.title)}
            <span className="truncate text-sm font-medium">
              {tab.title}
            </span>
            {tab.isModified && (
              <span className="text-red-500 text-xs ml-1">●</span>
            )}
          </button>
          <button 
            onClick={() => closeTab(tab.idx)} 
            className="p-1 hover:bg-gray-200 rounded mr-1 transition-colors"
            title="Close tab"
          >
            <X width={12} height={12} className="text-gray-500 hover:text-gray-700" />
          </button>
        </div>
      ))}
    </div>
  );
}
