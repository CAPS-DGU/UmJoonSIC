/** 에디터 우측 디버그창 */

import RunIcon from '@/assets/icons/debug/run.svg';
import ReRunIcon from '@/assets/icons/debug/rerun.svg';
import StopIcon from '@/assets/icons/debug/stop.svg';
import TimerIcon from '@/assets/icons/debug/timer.svg';

import RegisterValue from './RegisterValue';
import MemoryViewer from './MemoryViewer';
import { useRunMenu } from '@/hooks/RunMenu';
import { useRunningStore } from '@/stores/RunningStore';
import { Redo, StepForward } from 'lucide-react';
import { useRegisterStore } from '@/stores/RegisterStore';

export default function Debug() {
  const { run, rerun, stop } = useRunMenu();
  const isRunning = useRunningStore(s => s.isRunning);
  const toggleIsRunning = useRunningStore(s => s.toggleIsRunning);
  const fetchLoad = useRunningStore(s => s.fetchLoad);

  const handleRun = async (time?: number) => {
    fetchLoad();
    toggleIsRunning();
    await run();
  };

  return (
    <div className="flex flex-col w-max border border-gray-200">
      <section className="flex w-full items-center justify-between border-b border-gray-200 py-3 h-[54px] px-2">
        <h2 className="text-lg font-bold">실행 및 디버그</h2>
        <div className="flex space-x-2">
          {isRunning ? (
            <RunningButton rerun={rerun} stop={stop} />
          ) : (
            <DefaultButton handleRun={handleRun} />
          )}
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

function DefaultButton({ handleRun }: { handleRun: (time?: number) => Promise<void> }) {
  return (
    <>
      <button
        onClick={() => handleRun(1000)}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="1초 타임아웃으로 실행"
      >
        <img src={TimerIcon} alt="Timer" className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleRun()}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="실행"
      >
        <img src={RunIcon} alt="Run" className="w-4 h-4" />
      </button>
    </>
  );
}

function RunningButton({ rerun, stop }: { rerun: () => void; stop: () => void }) {
  const fetchRegisters = useRegisterStore(s => s.fetchRegisters);
  return (
    <>
      <button
        onClick={rerun}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="Continue"
      >
        <StepForward className="w-4 h-4" />
      </button>
      <button
        onClick={fetchRegisters}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="Step Over"
      >
        <Redo className="w-4 h-4" />
      </button>
      <button
        onClick={rerun}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="재실행"
      >
        <img src={ReRunIcon} alt="ReRun" className="w-4 h-4" />
      </button>
      <button
        onClick={stop}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="실행 중지"
      >
        <img src={StopIcon} alt="Stop" className="w-4 h-4" />
      </button>
    </>
  );
}
