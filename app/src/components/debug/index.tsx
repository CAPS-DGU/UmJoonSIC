import React, { useState, useRef, useEffect } from 'react';
import { Cpu, AlarmClock, Play, Pause } from 'lucide-react';
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
  
  const delay = async (time: number) => {
    await new Promise(resolve => setTimeout(resolve, time));
  };

  const handleRun = async () => {
    useRunningStore.getState().setIsPaused(true);
    await fetchLoad();
    toggleIsRunning();
    await fetchMemory();
    fetchVarMemoryValue();
  };

  const handleRunWithDelay = async (time: number, start: boolean = true) => {
    if(start) {
      await fetchLoad();
    }
    console.log('run with delay toggleIsRunning', isRunning);
    if(!isRunning) {
      toggleIsRunning();
    }
    setIsExecuting(true);
    await fetchMemory();
    fetchVarMemoryValue();
    console.log('run with delay start', useRunningStore.getState().isRunning);

    while(useRunningStore.getState().isRunning) {
      if(useRunningStore.getState().isPaused) {
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

  const [showModeMenu, setShowModeMenu] = useState<boolean>(false);
  const { mode: currentMode, setMode } = useMemoryViewStore();

  // 모달 외부 클릭 감지를 위한 ref
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
}

function DefaultButton({ handleRun, handleRunWithDelay, onToggleModeMenu }: DefaultButtonProps) {

  return (
    <>
      <button
        onClick={() => handleRunWithDelay(1000)}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="1초 타임아웃으로 실행"
      >
        <AlarmClock className="w-4 h-4" />
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

function RunningButton({ handleRunWithDelay }: { handleRunWithDelay: (time: number, start: boolean) => Promise<void> }) {
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
        onClick={stopRunning}
        className="hover:bg-gray-100 p-2 rounded-md transition-colors"
        title="실행 중지"
      >
        <Square className="w-4 h-4" />
      </button>
    </>
  );
}
