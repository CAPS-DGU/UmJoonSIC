import { useRef, useState } from 'react';
import { InfoModal } from '@/components/InfoModal';
import Resizer from '@/components/Resizer';
import StatusBar from '@/components/StatusBar';
import DebugPanel from '@/features/debugger/DebugPanel';
import EditorContainer from '@/features/editor/EditorContainer';
import { tabKind, useEditorTabStore } from '@/features/editor/editorTabStore';
import { useCloseRequests } from '@/features/editor/hooks/useCloseRequests';
import { useTabShortcuts } from '@/features/editor/hooks/useTabShortcuts';
import SideBar from '@/features/fileTree/SideBar';
import ListingView from '@/features/listing/ListingView';
import BottomPanel from '@/features/panel/BottomPanel';
import { useServerLog } from '@/features/panel/useServerLog';
import ProjectSettings from '@/features/project/ProjectSettings';
import { useProjectStore } from '@/features/project/projectStore';
import { useProjectEvents } from '@/features/project/useProjectEvents';
import WelcomeScreen from '@/features/project/WelcomeScreen';

/** Height the panel resizer reserves at the bottom of the window, in px. */
const STATUS_BAR_HEIGHT = 40;
const INITIAL_PANEL_HEIGHT = 250;

/** What the centre area shows depends on the active tab: a listing, the project settings, or the editor. */
function MainView({ activePath }: { activePath: string | null }) {
  const kind = activePath ? tabKind(activePath) : 'source';
  if (kind === 'listing') return <ListingView />;
  if (kind === 'settings') return <ProjectSettings />;
  return <EditorContainer />;
}

function App() {
  const projectName = useProjectStore(s => s.projectName);
  const activePath = useEditorTabStore(state => state.activePath);
  const [panelHeight, setPanelHeight] = useState(INITIAL_PANEL_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);

  useProjectEvents();
  useServerLog();
  useCloseRequests();
  useTabShortcuts();

  if (projectName === '') {
    return <WelcomeScreen />;
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="flex flex-1 overflow-hidden" ref={appRef}>
        <div className="w-64">
          <SideBar />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <MainView activePath={activePath} />
          </div>
          <Resizer
            onResize={setPanelHeight}
            containerRef={appRef}
            statusBarHeight={STATUS_BAR_HEIGHT}
            onDragStart={() => setIsResizing(true)}
            onDragEnd={() => setIsResizing(false)}
          />
          {/* no height transition while dragging, so the panel follows the pointer */}
          <div
            className={isResizing ? '' : 'transition-all duration-200 ease-in-out'}
            style={{ height: panelHeight }}
          >
            <BottomPanel />
          </div>
        </div>
        <div className="min-w-64 max-w-xs flex-shrink-0 overflow-y-auto overflow-x-hidden">
          <DebugPanel />
        </div>
      </div>
      <StatusBar />
      <InfoModal />
    </div>
  );
}

export default App;
