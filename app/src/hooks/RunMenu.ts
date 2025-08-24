// src/hooks/RunMenu.ts
/** 에디터 우측 디버그창 핸들러 함수 */
import { useProjectStore } from '@/stores/ProjectStore';

export function useRunMenu() {
  const getAsmAbsolutePaths = useProjectStore(s => s.getAsmAbsolutePaths);

  const run = () => {
    const abs = getAsmAbsolutePaths();
    if (abs.length === 0) {
      console.warn('No project files under "asm".');
      return;
    }
    abs.forEach(p => console.log(p));
  };

  const rerun = () => console.log('ReRun');
  const stop = () => console.log('Stop');
  return { run, rerun, stop };
}


