/** 에디터 우측 디버그창 */

import RunIcon from '@/assets/icons/debug/run.svg';
import ReRunIcon from '@/assets/icons/debug/rerun.svg';
import StopIcon from '@/assets/icons/debug/stop.svg';

import RegisterValue from './RegisterValue';
import MemoryViewer from './MemoryViewer';
import { useRunMenu } from '@/hooks/RunMenu';

export default function Debug() {
  const { run, rerun, stop } = useRunMenu();

  return (
    <div className="flex flex-col w-max border border-gray-200">
      <section className="flex w-full items-center justify-between border-b border-gray-200 py-3 h-[54px] px-2">
        <h2 className="text-lg font-bold">실행 및 디버그</h2>
        <div className="flex space-x-2">
          <button onClick={run} className="hover:bg-gray-100 p-2 rounded-md transition-colors">
            <img src={RunIcon} alt="Run" className="w-4 h-4" />
          </button>
          <button onClick={rerun} className="hover:bg-gray-100 p-2 rounded-md transition-colors">
            <img src={ReRunIcon} alt="ReRun" className="w-4 h-4" />
          </button>
          <button onClick={stop} className="hover:bg-gray-100 p-2 rounded-md transition-colors">
            <img src={StopIcon} alt="Stop" className="w-4 h-4" />
          </button>
        </div>
      </section>
      <section className="border-b border-gray-200 py-3">
        <RegisterValue />
      </section>
      <section className="border-b border-gray-200 py-3">
        <MemoryViewer />
      </section>
    </div>
  );
}
