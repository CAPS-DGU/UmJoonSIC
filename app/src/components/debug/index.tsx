import { useState, useRef, useEffect } from 'react';
import { Cpu, AlarmClock, Play, Pause, Settings } from 'lucide-react';
import RegisterValue from './RegisterValue';
import MemoryViewer from './MemoryViewer';
import { useRunningStore } from '@/stores/RunningStore';
import { Redo, StepForward, RotateCcw, Square } from 'lucide-react';
import { useRegisterStore } from '@/stores/RegisterStore';
import { useMemoryViewStore, type MachineMode } from '@/stores/MemoryViewStore';
import { useWatchStore } from '@/stores/pannel/WatchStore';

export default function Debug() {
  const isRunning = useRunningStore(s => s.isRunning);
  const toggleIsRunning = useRunningStore(s => s.toggleIsRunning);
  const fetchLoad = useRunningStore(s => s.fetchLoad);
  const fetchMemory = useMemoryViewStore(s => s.fetchMemoryValues);
  const fetchVarMemoryValue = useWatchStore(s => s.fetchVarMemoryValue);
  const fetchRegisters = useRegisterStore(s => s.fetchRegisters);
  const [isExecuting, setIsExecuting] = useState(false);

  const delayTime = useRunningStore(s => s.delayTime);
  const setDelayTime = useRunningStore(s => s.setDelayTime);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayInput, setDelayInput] = useState<string>('1000');
  
  const delay = async (time: number) => {
    await new Promise(resolve => setTimeout(resolve, time));
  };

  const handleRun = async () => {
    useRunningStore.getState().setIsPaused(true);
    await fetchLoad();
    toggleIsRunning();
    await fetchMemory();
    fetchVarMemoryValue();
    setIsExecuting(true);
  };

  const handleRunWithDelay = async (time: number, start: boolean = true) => {
  if (start) {
    await fetchLoad();
  }
  console.log('run with delay toggleIsRunning', isRunning);
  
  if (!isRunning) {
    toggleIsRunning();
  }
  setIsExecuting(true);
  
  await fetchMemory();
  fetchVarMemoryValue();
  console.log('run with delay start', useRunningStore.getState().isRunning);

  while (useRunningStore.getState().isRunning) {
    if (useRunningStore.getState().isPaused) {
      break;
    }
    console.log('run with delay loop');
    await delay(time);
    fetchRegisters();
    fetchMemory();
    fetchVarMemoryValue();
  }
  console.log('run with delay end');
};

  const openDelayModal = () => {
    setDelayInput(String(delayTime || 1000));
    setShowDelayModal(true);
  };

  const confirmDelayAndRun = () => {
    const parsed = Number(delayInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setDelayTime(parsed);
    setShowDelayModal(false);
    handleRunWithDelay(parsed);
  };

  const confirmDelaySave = () => {
    const parsed = Number(delayInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setDelayTime(parsed);
    setShowDelayModal(false);
  };

  const [showModeMenu, setShowModeMenu] = useState<boolean>(false);
  const { mode: currentMode, setMode } = useMemoryViewStore();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowModeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleModeChange = (newMode: MachineMode) => {
    setMode(newMode);
  };

  return (
    <div className="flex flex-col w-max border border-gray-200">
      <section className="flex w-full items-center justify-between border-b border-gray-200 py-3 h-[54px] px-2">
        <h2 className="text-lg font-bold">실행</h2>

        <div className="flex space-x-2 relative" ref={menuRef}>
          {' '}
          {/* ref 할당 */}
          {isRunning ? (
            <RunningButton handleRunWithDelay={handleRunWithDelay} />
          ) : (
            <DefaultButton
              handleRun={handleRun}
              handleRunWithDelay={handleRunWithDelay}
              onToggleModeMenu={() => setShowModeMenu(!showModeMenu)}
              onOpenDelayModal={openDelayModal}
              delayTime={delayTime}
            />
          )}
          {showModeMenu && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg p-2 z-10">
              <div className="flex flex-col space-y-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="machineMode"
                    value="SIC"
                    checked={currentMode === 'SIC'}
                    onChange={() => handleModeChange('SIC')}
                  />
                  <span>SIC 모드</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="machineMode"
                    value="SICXE"
                    checked={currentMode === 'SICXE'}
                    onChange={() => handleModeChange('SICXE')}
                  />
                  <span>SIC/XE 모드</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </section>
      {showDelayModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-80">
            <h3 className="text-base font-semibold mb-2">지연 시간(ms)을 입력하세요</h3>
            <input
              type="number"
              min={0}
              value={delayInput}
              onChange={e => setDelayInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmDelaySave();
              }}
              className="w-full border border-gray-300 rounded-md px-2 py-1 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300"
                onClick={() => setShowDelayModal(false)}
              >
                취소
              </button>
              <button
                className="px-3 py-1 rounded-md bg-blue-500 text-white hover:bg-blue-600"
                onClick={confirmDelaySave}
              >
                저장
              </button>
              <button
                className="px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700"
                onClick={confirmDelayAndRun}
              >
                저장 후 실행
              </button>
            </div>
          </div>
        </div>
      )}
      <section className="border-b border-gray-200 py-3">
        <RegisterValue />
      </section>
      <section className="border-b border-gray-200 py-3">
        <MemoryViewer isExecuting={isExecuting} />
      </section>
    </div>
  );
}

interface DefaultButtonProps {
  handleRun: () => Promise<void>;
  handleRunWithDelay: (time: number) => Promise<void>;
  onToggleModeMenu: () => void;
  onOpenDelayModal: () => void;
  delayTime: number;
}

function DefaultButton({ handleRun, handleRunWithDelay, onToggleModeMenu, onOpenDelayModal, delayTime }: DefaultButtonProps) {

  return (
    <>
      <button
        onClick={() => handleRunWithDelay(delayTime || 1000)}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title={`지연(${delayTime || 1000}ms)으로 실행`}
      >
        <AlarmClock className="w-4 h-4" />
      </button>
      <button
        onClick={onOpenDelayModal}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="지연 시간 설정"
      >
        <Settings className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleRun()}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="실행"
      >
        <Play className="w-4 h-4" />
      </button>
      <button
        onClick={onToggleModeMenu}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="아키텍처 설정"
      >
        <Cpu className="w-4 h-4" />
      </button>
    </>
  );
}
function RunningButton({
  handleRunWithDelay,
  setIsExecuting,
}: {
  handleRunWithDelay: (time: number, start: boolean) => Promise<void>;
  setIsExecuting: (e: boolean) => void;
}) {
  const fetchRegisters = useRegisterStore(s => s.fetchRegisters);
  const fetchMemory = useMemoryViewStore(s => s.fetchMemoryValues);
  const stopRunning = useRunningStore(s => s.stopRunning);
  const fetchLoad = useRunningStore(s => s.fetchLoad);
  const toggleIsRunning = useRunningStore(s => s.toggleIsRunning);
  const fetchVarMemoryValue = useWatchStore(s => s.fetchVarMemoryValue);
  
  return (
    <>
      {!useRunningStore.getState().isPaused ? (
        <button
          onClick={() => {
            useRunningStore.getState().setIsPaused(true);
            console.log('Pause');
          }}
          className="hover:bg-gray-100 p-2 rounded-md transition-colors"
          title="Pause"
        >
          <Pause className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={() => {
            console.log('Continue');
            useRunningStore.getState().setIsPaused(false);
            handleRunWithDelay(1000, false);
          }}
          className="hover:bg-gray-100 p-2 rounded-md transition-colors"
          title="Continue"
        >
          <StepForward className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={() => {
          useRunningStore.getState().setIsPaused(true);
          console.log('Pause');
        }}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="Pause"
      >
        <Pause className="w-4 h-4" />
      </button>) : (
      <button
        onClick={() => {
          console.log('Continue');
          useRunningStore.getState().setIsPaused(false);
          handleRunWithDelay(1000, false);
        }}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="Continue"
      >
        <StepForward className="w-4 h-4" />
      </button> )}
      {useRunningStore.getState().isPaused && <button
        onClick={() => {
          fetchRegisters();
          fetchMemory();
          fetchVarMemoryValue();
        }}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="Step Over"
      >
        <Redo className="w-4 h-4" />
      </button>}
      <button
        onClick={async () => {
          await stopRunning();
          await fetchLoad();
          toggleIsRunning();
        }}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="재실행"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          stopRunning();
          setIsExecuting(false);
        }}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="실행 중지"
      >
        <Square className="w-4 h-4" />
      </button>
    </>
  );
}
