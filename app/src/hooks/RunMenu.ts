// src/hooks/RunMenu.ts
/** 에디터 우측 디버그창 핸들러 함수 */

import { useProjectStore } from '@/stores/ProjectStore';

export function useRunMenu() {
  const projectPath = useProjectStore(state => state.projectPath);
  const fileTree = useProjectStore(state => state.fileTree);

  const run = () => {
    if (!projectPath) {
      console.warn('No project path set');
      return;
    }

    if (!fileTree.length) {
      console.warn('No files found in project');
      return;
    }

    // Print absolute paths
    fileTree.forEach(file => {
      console.log(`${projectPath}/${file}`);
    });
  };

  const rerun = () => {
    console.log('⏩ ReRun');
  };

  const stop = () => {
    console.log('⏹ Stop');
  };

  return { run, rerun, stop };
}

