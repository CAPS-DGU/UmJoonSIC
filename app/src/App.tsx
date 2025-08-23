// src/App.tsx

import React, { useState, useEffect, useRef } from 'react';
import SideBar from '@/components/common/SideBar';
import ToolBar from '@/components/common/ToolBar';
import UnderStatusBar from '@/components/common/UnderStatusBar';
import Debug from '@/components/debug';
import EditorContainer from './components/editor/EditorContainer';
import ListContainer from './components/assembleList/ListContainer';
import { useProjectStore } from './stores/ProjectStore';
import { useEditorTabStore } from './stores/EditorTabStore';

import WarningPanel from './components/warning/WarningPanel';
import Resizer from './components/common/Resizer';

const STATUS_BAR_HEIGHT = 40;

function App() {
  const { createNewProject, projectName } = useProjectStore();
  const { tabs, activeTabIdx } = useEditorTabStore();

  const [panelHeight, setPanelHeight] = useState(0);
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
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-bold">아직 프로젝트를 생성하지 않았습니다.</h1>
        <p className="text-sm text-gray-500">
          File &gt; New Project 를 클릭하여 프로젝트를 생성해주세요.
        </p>
      </div>
    );
  }

  const activeTab = tabs[activeTabIdx];
  const isLstFile = activeTab?.filePath?.toLowerCase().endsWith('.lst');

  return (
    <div className="flex h-screen w-screen flex-col">
      <ToolBar />
      <div className="flex flex-1 overflow-hidden" ref={appRef}>
        <div className="w-64">
          <SideBar />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {isLstFile ? <ListContainer /> : <EditorContainer />}
          </div>
          <Resizer onMouseDown={() => setIsResizing(true)} />
          <div className="transition-all duration-200 ease-in-out" style={{ height: panelHeight }}>
            <WarningPanel />
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
