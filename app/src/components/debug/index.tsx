/** 에디터 우측 디버그창 */

import RunIcon from '@/assets/icons/debug/run.svg';
import ReRunIcon from '@/assets/icons/debug/rerun.svg';
import StopIcon from '@/assets/icons/debug/stop.svg';
import TimerIcon from '@/assets/icons/debug/timer.svg';

import RegisterValue from './RegisterValue';
import MemoryViewer from './MemoryViewer';
import { useRunningStore } from '@/stores/RunningStore';
import { Redo, StepForward } from 'lucide-react';
import { useRegisterStore } from '@/stores/RegisterStore';
import { useMemoryViewStore } from '@/stores/MemoryViewStore';
import { useWatchStore } from '@/stores/pannel/WatchStore';

export default function Debug() {
  const isRunning = useRunningStore(s => s.isRunning);
  const toggleIsRunning = useRunningStore(s => s.toggleIsRunning);
  const fetchLoad = useRunningStore(s => s.fetchLoad);
  const fetchMemory = useMemoryViewStore(s => s.fetchMemoryValues);
  const fetchVarMemoryValue = useWatchStore(s => s.fetchVarMemoryValue);

  const handleRun = async (time?: number) => {
    await fetchLoad();
    toggleIsRunning();
    await fetchMemory();
    fetchVarMemoryValue();
  };

  return (
    <div className="flex flex-col w-max border border-gray-200">
      <section className="flex w-full items-center justify-between border-b border-gray-200 py-3 h-[54px] px-2">
        <h2 className="text-lg font-bold">실행 및 디버그</h2>
        <div className="flex space-x-2">
          {isRunning ? <RunningButton /> : <DefaultButton handleRun={handleRun} />}
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

function RunningButton() {
  const fetchRegisters = useRegisterStore(s => s.fetchRegisters);
  const fetchMemory = useMemoryViewStore(s => s.fetchMemoryValues);
  const stopRunning = useRunningStore(s => s.stopRunning);
  const fetchLoad = useRunningStore(s => s.fetchLoad);
  const toggleIsRunning = useRunningStore(s => s.toggleIsRunning);
  const fetchVarMemoryValue = useWatchStore(s => s.fetchVarMemoryValue);
  return (
    <>
      <button
        onClick={() => {}}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="Continue"
      >
        <StepForward className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          fetchRegisters();
          fetchMemory();
          fetchVarMemoryValue();
        }}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="Step Over"
      >
        <Redo className="w-4 h-4" />
      </button>
      <button
        onClick={async () => {
          await stopRunning();
          await fetchLoad();
          toggleIsRunning();
        }}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="재실행"
      >
        <img src={ReRunIcon} alt="ReRun" className="w-4 h-4" />
      </button>
      <button
        onClick={stopRunning}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="실행 중지"
      >
        <img src={StopIcon} alt="Stop" className="w-4 h-4" />
      </button>
    </>
  );
}
