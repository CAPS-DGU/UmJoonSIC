import { useEffect, useRef, useState } from 'react';
import type { MachineMode } from '@/api/types';
import { DelayModal } from '@/features/debugger/DelayModal';
import MemoryViewer from '@/features/debugger/memory/MemoryViewer';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { ModeMenu } from '@/features/debugger/ModeMenu';
import RegisterPanel from '@/features/debugger/RegisterPanel';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { IdleButtons, RunningButtons } from '@/features/debugger/RunToolbar';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useWatchStore } from '@/features/panel/watchStore';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Right-hand column: run toolbar, registers and memory. */
export default function DebugPanel() {
  const isRunning = useRunningStore(s => s.isRunning);
  const toggleIsRunning = useRunningStore(s => s.toggleIsRunning);
  const loadProgram = useRunningStore(s => s.loadProgram);
  const delayTime = useRunningStore(s => s.delayTime);
  const setDelayTime = useRunningStore(s => s.setDelayTime);
  const fetchMemory = useMemoryViewStore(s => s.fetchMemoryValues);
  const fetchVarMemoryValue = useWatchStore(s => s.fetchVarMemoryValue);
  const step = useRegisterStore(s => s.step);
  // NOTE: subscribes to the whole memory store, as before. The resulting re-render after
  // each memory refresh is what keeps the toolbar's pause/continue button up to date.
  const { mode, setMode } = useMemoryViewStore();

  /** A program has been started; the memory viewer follows the PC while this is set. */
  const [isExecuting, setIsExecuting] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close the mode menu on a click outside the toolbar.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setShowModeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /** Load the program and stop at its first instruction, for manual stepping. */
  const run = async () => {
    useRunningStore.getState().setIsPaused(true);
    await loadProgram();
    toggleIsRunning();
    await fetchMemory();
    fetchVarMemoryValue();
    setIsExecuting(true);
  };

  /**
   * Auto-play: execute one instruction every `delayMs` until the user pauses or stops it.
   * `load` is false when resuming a program that is already loaded.
   */
  const runWithDelay = async (delayMs: number, load: boolean = true) => {
    if (load) {
      await loadProgram();
    }
    if (!isRunning) {
      toggleIsRunning();
    }
    setIsExecuting(true);
    await fetchMemory();
    fetchVarMemoryValue();

    while (useRunningStore.getState().isRunning) {
      if (useRunningStore.getState().isPaused) {
        break;
      }
      await sleep(delayMs);
      // Not awaited: the next iteration starts before this step's result has arrived.
      step();
      fetchMemory();
      fetchVarMemoryValue();
    }
  };

  return (
    <div className="flex flex-col w-max border border-gray-200">
      <section className="flex w-full items-center justify-between border-b border-gray-200 py-3 h-[54px] px-2">
        <h2 className="text-lg font-bold">실행</h2>
        <div className="flex space-x-2 relative" ref={toolbarRef}>
          {isRunning ? (
            <RunningButtons
              onContinue={delayMs => runWithDelay(delayMs, false)}
              onStopped={() => setIsExecuting(false)}
            />
          ) : (
            <IdleButtons
              delayTime={delayTime}
              onRun={run}
              onRunWithDelay={runWithDelay}
              onOpenDelayModal={() => setShowDelayModal(true)}
              onToggleModeMenu={() => setShowModeMenu(!showModeMenu)}
            />
          )}
          {showModeMenu && (
            <ModeMenu mode={mode} onChange={(newMode: MachineMode) => setMode(newMode)} />
          )}
        </div>
      </section>

      {showDelayModal && (
        <DelayModal
          delayTime={delayTime}
          onCancel={() => setShowDelayModal(false)}
          onSave={newDelay => {
            setDelayTime(newDelay);
            setShowDelayModal(false);
          }}
          onSaveAndRun={newDelay => {
            setDelayTime(newDelay);
            setShowDelayModal(false);
            runWithDelay(newDelay);
          }}
        />
      )}

      <section className="border-b border-gray-200 py-3">
        <RegisterPanel />
      </section>
      <section className="border-b border-gray-200 py-3">
        <MemoryViewer isExecuting={isExecuting} />
      </section>
    </div>
  );
}
