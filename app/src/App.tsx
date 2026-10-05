import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { InfoModal } from '@/components/InfoModal';
import Splitter from '@/components/Splitter';
import StatusBar from '@/components/StatusBar';
import DebugPanel from '@/features/debugger/DebugPanel';
import EditorContainer from '@/features/editor/EditorContainer';
import { tabKind, useEditorTabStore } from '@/features/editor/editorTabStore';
import { useCloseRequests } from '@/features/editor/hooks/useCloseRequests';
import { useTabShortcuts } from '@/features/editor/hooks/useTabShortcuts';
import SideBar from '@/features/fileTree/SideBar';
import {
  BOTTOM_PANEL,
  clamp,
  DEBUG_COLUMN,
  dragRange,
  FILES_COLUMN,
  fitColumns,
  panelRange,
} from '@/features/layout/columns';
import { useLayoutStore } from '@/features/layout/layoutStore';
import { useElementSize } from '@/features/layout/useElementSize';
import ListingView from '@/features/listing/ListingView';
import BottomPanel from '@/features/panel/BottomPanel';
import { useServerLog } from '@/features/panel/useServerLog';
import ProjectSettings from '@/features/project/ProjectSettings';
import { useProjectStore } from '@/features/project/projectStore';
import { useProjectEvents } from '@/features/project/useProjectEvents';
import WelcomeScreen from '@/features/project/WelcomeScreen';

/** A divider between two columns: no width of its own, a 4 px grip over the borders. */
const COLUMN_SPLITTER =
  'relative z-10 -mx-[2px] w-[4px] shrink-0 transition-colors hover:bg-blue-400/50 focus-visible:bg-blue-500';

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
  const layout = useLayoutStore(
    useShallow(s => ({
      filesWidth: s.filesWidth,
      debugWidth: s.debugWidth,
      panelHeight: s.panelHeight,
      setFilesWidth: s.setFilesWidth,
      setDebugWidth: s.setDebugWidth,
      setPanelHeight: s.setPanelHeight,
      save: s.save,
    })),
  );
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  const [middle, setMiddle] = useState<HTMLDivElement | null>(null);
  const rowSize = useElementSize(row);
  const middleSize = useElementSize(middle);

  useProjectEvents();
  useServerLog();
  useCloseRequests();
  useTabShortcuts();

  if (projectName === '') {
    return <WelcomeScreen />;
  }

  // The side columns get the widths the user chose, fitted into the window (columns.ts).
  const total = Math.floor(rowSize.width || window.innerWidth);
  const fit = fitColumns(total, { files: layout.filesWidth, debug: layout.debugWidth });
  const filesRange = dragRange(FILES_COLUMN, total, fit.debug);
  const debugRange = dragRange(DEBUG_COLUMN, total, fit.files);
  const panel = panelRange(middleSize.height);
  // While a divider is used, the side columns are what they show: dragging one must not let the
  // other grow back into room the window had taken from both.
  const pinColumns = () => {
    layout.setFilesWidth(fit.files);
    layout.setDebugWidth(fit.debug);
  };
  const panelHeight = middleSize.height
    ? clamp(layout.panelHeight, panel.min, panel.max)
    : layout.panelHeight;

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="flex flex-1 overflow-hidden" ref={setRow}>
        <div data-column="files" className="shrink-0 min-w-0" style={{ width: fit.files }}>
          <SideBar />
        </div>
        <Splitter
          orientation="vertical"
          label="파일 목록 너비"
          value={fit.files}
          {...filesRange}
          onStart={pinColumns}
          onChange={layout.setFilesWidth}
          onReset={() => layout.setFilesWidth(FILES_COLUMN.default)}
          onCommit={layout.save}
          className={COLUMN_SPLITTER}
        />
        <div
          data-column="editor"
          className="flex flex-col flex-1 min-w-0 overflow-hidden"
          ref={setMiddle}
        >
          <div className="flex-1 min-h-0 overflow-hidden">
            <MainView activePath={activePath} />
          </div>
          <Splitter
            orientation="horizontal"
            label="아래 패널 높이"
            value={panelHeight}
            {...panel}
            invert
            onChange={layout.setPanelHeight}
            onReset={() => layout.setPanelHeight(BOTTOM_PANEL.default)}
            onCommit={layout.save}
            className="h-1 w-full shrink-0 bg-gray-600 hover:bg-gray-400 focus-visible:bg-blue-500"
          />
          <div className="shrink-0" style={{ height: panelHeight }}>
            <BottomPanel />
          </div>
        </div>
        <Splitter
          orientation="vertical"
          label="실행 패널 너비"
          value={fit.debug}
          {...debugRange}
          invert
          onStart={pinColumns}
          onChange={layout.setDebugWidth}
          onReset={() => layout.setDebugWidth(DEBUG_COLUMN.default)}
          onCommit={layout.save}
          className={COLUMN_SPLITTER}
        />
        <div
          data-column="debug"
          className="slim-scroll shrink-0 min-w-0 overflow-y-auto overflow-x-hidden border-l border-gray-300 bg-white"
          style={{ width: fit.debug }}
        >
          <DebugPanel />
        </div>
      </div>
      <StatusBar />
      <InfoModal />
    </div>
  );
}

export default App;
