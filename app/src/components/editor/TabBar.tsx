import { useEditorTabStore } from '@/stores/EditorTabStore';
import { File, X, Settings } from 'lucide-react';

export default function TabBar() {
  const { tabs, closeTab, setActiveTab } = useEditorTabStore();

  const getFileIcon = (fileName: string) => {
    if (fileName.toLowerCase() === 'project.sic') {
      return <Settings width={16} height={16} />;
    }
    return <File width={16} height={16} />;
  };

  return (
    <div className="flex flex-row overflow-x-auto">
      {tabs.map(tab => (
        <div
          key={tab.filePath}
          className={`flex flex-row p-1 px-2 ${tab.isActive ? 'bg-gray-200' : ''}`}
        >
          <div className="flex flex-row">
            <button
              onClick={() => setActiveTab(tab.idx)}
              className="hover:bg-gray-200 flex flex-row"
            >
              {getFileIcon(tab.title)}
              {tab.title} {tab.isModified ? '*' : ''}
            </button>
            <button onClick={() => closeTab(tab.idx)} className="hover:bg-gray-200">
              <X width={16} height={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
