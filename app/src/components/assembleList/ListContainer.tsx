// src/components/editor/ListContainer.tsx
import React, { useState, useEffect } from 'react';
import { useEditorTabStore } from '@/stores/EditorTabStore';
import { useListFileStore } from '@/stores/ListFileStore';
import type { ListFileRow } from '@/stores/ListFileStore';
import TabBar from '../editor/TabBar';
import List from './List';
import path from 'path-browserify';
import { useProjectStore } from '@/stores/ProjectStore';

export default function ListContainer() {
  const {
    tabs,
    activeTabIdx,
    addBreakpoint,
    removeBreakpoint,
    toggleBreakpoint,
    clearBreakpoints,
    getActiveTab,
  } = useEditorTabStore();
  const { projectPath } = useProjectStore();
  const { listFile } = useListFileStore();
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const activeTab = getActiveTab();
  /*
  useEffect(() => {
    const fetchFileData = async () => {
      if (activeTab?.filePath?.endsWith('.lst')) {
        try {
          // 백엔드(Electron Main Process)에 파일 내용 요청
          const result = await window.electronAPI.readFile(activeTab.filePath);
          if (result.success) {
            // 성공적으로 데이터를 받으면, 스토어에 저장합니다.
            setListFile(result.data as ListFileRow[]);
          } else {
            console.error('Failed to read .lst file:', result.message);
            setListFile([]);
          }
        } catch (error) {
          console.error('Error fetching file data:', error);
          setListFile([]);
        }
      } else {
        // .lst 파일이 아니면 스토어 데이터를 초기화합니다.
        setListFile([]);
      }
    };

    fetchFileData();
  }, [activeTab, setListFile]);
  */
  // toggleBreakpoint 변수가 중복 선언되어 오류가 발생하므로, 아래 코드를 삭제하거나 기존 toggleBreakpoint를 사용하세요.

  useEffect(() => {
    console.log(activeTab);
    console.log(listFile);
    console.log(path.join(activeTab?.filePath.replace('.lst', '') || 'ss'));
    console.log(listFile.map(file => file.filePath));
    console.log(
      listFile.find(
        file => file.filePath === path.join(activeTab?.filePath.replace('.lst', '') || ''),
      )?.rows,
    );
  }, []);

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <TabBar />
      <List
        data={
          listFile.find(
            file =>
              file.filePath === path.join(activeTab?.filePath.replace('.lst', '') || ''),
          )?.rows ?? []
        } // 스토어에서 가져온 listFile을 사용합니다.
        activeTabTitle={activeTab?.title}
        breakpoints={breakpoints}
        onBreakpointToggle={index => toggleBreakpoint(activeTab?.idx || 0, index)}
      />
    </div>
  );
}
