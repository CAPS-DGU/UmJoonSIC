import { useState, useEffect, useRef } from 'react';
import SideBar from '@/components/common/SideBar';
import UnderStatusBar from '@/components/common/UnderStatusBar';
import Debug from '@/components/debug';
import EditorContainer from './components/editor/EditorContainer';
import ListContainer from './components/assembleList/ListContainer';
import { useProjectStore } from './stores/ProjectStore';
import { useEditorTabStore } from './stores/EditorTabStore';

import Pannel from './components/pannel/Pannel';
import Resizer from './components/common/Resizer';
import SicSettingContainer from './components/setting/SicSettingContainer';

const STATUS_BAR_HEIGHT = 40;

function App() {
  const createNewProject = useProjectStore(s => s.createNewProject);
  const openProject = useProjectStore(s => s.openProject);
  const projectName = useProjectStore(s => s.projectName);
  const closeProject = useProjectStore(s => s.closeProject);
  const { tabs, activeTabIdx } = useEditorTabStore();

  const [panelHeight, setPanelHeight] = useState(100);
  const [isResizing, setIsResizing] = useState(false);

  const appRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleCreateNewProject = () => {
      createNewProject();
    };

    window.addEventListener('create-new-project', handleCreateNewProject);

    return () => {
      window.removeEventListener('create-new-project', handleCreateNewProject);
    };
  }, [createNewProject]);

  useEffect(() => {
    const handleOpenProject = () => {
      openProject();
    };
    window.addEventListener('open-project', handleOpenProject);
    return () => {
      window.removeEventListener('open-project', handleOpenProject);
    };
  }, [openProject]);

  useEffect(() => {
    const handleCloseProject = () => {
      closeProject();
    };
    window.addEventListener('close-project', handleCloseProject);
    return () => {
      window.removeEventListener('close-project', handleCloseProject);
    };
  }, [closeProject]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !appRef.current) return;

      const appRect = appRef.current.getBoundingClientRect();
      const newPanelHeight = appRect.bottom - STATUS_BAR_HEIGHT - e.clientY;

      setPanelHeight(Math.max(0, newPanelHeight));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (projectName === '') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold mb-4">아직 프로젝트를 생성하지 않았습니다.</h1>
          <p className="text-sm text-gray-500 mb-8">
            File &gt; New Project 를 클릭하여 프로젝트를 생성하거나
            <br />
            File &gt; Open Project 를 클릭하여 기존 프로젝트를 열어주세요.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              onClick={() => {
                // File > New Project 메뉴와 동일하게 커스텀 이벤트 발생
                window.dispatchEvent(new Event('create-new-project'));
              }}
            >
              새 프로젝트 생성
            </button>
            <button
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
              onClick={() => {
                // File > Open Project 메뉴와 동일하게 커스텀 이벤트 발생
                window.dispatchEvent(new Event('open-project'));
              }}
            >
              기존 프로젝트 열기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeTab = tabs[activeTabIdx];
  const isLstFile = activeTab?.filePath?.toLowerCase().endsWith('.lst');
  const isSicFile = activeTab?.filePath?.toLowerCase().endsWith('project.sic');

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="flex flex-1 overflow-hidden" ref={appRef}>
        <div className="w-64">
          <SideBar />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {isLstFile ? (
              <ListContainer />
            ) : isSicFile ? (
              <SicSettingContainer />
            ) : (
              <EditorContainer />
            )}
          </div>
          <Resizer onMouseDown={() => setIsResizing(true)} />
          <div className="transition-all duration-200 ease-in-out" style={{ height: panelHeight }}>
            <Pannel />
          </div>
        </div>
        <div className="min-w-64 max-w-xs flex-shrink-0 overflow-y-auto overflow-x-hidden">
          <Debug />
        </div>
      </div>
      <UnderStatusBar />
    </div>
  );
}

export default App;
