import ConsolePanel from '@/features/panel/ConsolePanel';
import ErrorPanel from '@/features/panel/ErrorPanel';
import { usePanelStore, type PanelTab } from '@/features/panel/panelStore';
import WatchPanel from '@/features/panel/WatchPanel';
import { useStrings } from '@/i18n';

/** The panel under the editor: Watch, Errors and Simulator tabs. */
export default function BottomPanel() {
  const t = useStrings();
  const activeTab = usePanelStore(s => s.activeTab);
  const setActiveTab = usePanelStore(s => s.setActiveTab);
  const TABS: { key: PanelTab; label: string }[] = [
    { key: 'watch', label: t.panel.watch },
    { key: 'errors', label: t.panel.errors },
    { key: 'server', label: t.panel.server },
  ];

  return (
    <div className="bg-gray-100 text-gray-900 flex flex-col h-full overflow-hidden border-t border-gray-300">
      <div className="flex h-10 shrink-0 border-b border-gray-300">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 text-sm font-medium transition-colors flex justify-center items-center rounded-t ${
              activeTab === tab.key
                ? 'shadow-[inset_0_-2px_0_var(--color-blue-500)] text-blue-700 bg-white'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full">
          {activeTab === 'watch' && <WatchPanel />}
          {activeTab === 'errors' && <ErrorPanel />}
          {activeTab === 'server' && <ConsolePanel />}
        </div>
      </div>
    </div>
  );
}
