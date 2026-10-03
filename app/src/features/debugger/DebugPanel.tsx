import { useEffect, useRef, useState } from 'react';
import { DelayModal } from '@/features/debugger/DelayModal';
import MemoryViewer from '@/features/debugger/memory/MemoryViewer';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { ModeMenu } from '@/features/debugger/ModeMenu';
import RegisterPanel from '@/features/debugger/RegisterPanel';
import { IdleButtons, RunningButtons } from '@/features/debugger/RunToolbar';
import { useRunningStore } from '@/features/debugger/runningStore';

/** Right-hand column: run toolbar, registers and memory. */
export default function DebugPanel() {
  const isRunning = useRunningStore(s => s.isRunning);
  const delayTime = useRunningStore(s => s.delayTime);
  const setDelayTime = useRunningStore(s => s.setDelayTime);
  const runWithDelay = useRunningStore(s => s.runWithDelay);
  const mode = useMemoryViewStore(s => s.mode);
  const setMode = useMemoryViewStore(s => s.setMode);

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

  return (
    <div className="flex flex-col w-max border border-gray-200">
      <section className="flex w-full items-center justify-between border-b border-gray-200 py-3 h-[54px] px-2">
        <h2 className="text-lg font-bold">실행</h2>
        <div className="flex space-x-2 relative" ref={toolbarRef}>
          {isRunning ? (
            <RunningButtons />
          ) : (
            <IdleButtons
              delayTime={delayTime}
              onOpenDelayModal={() => setShowDelayModal(true)}
              onToggleModeMenu={() => setShowModeMenu(!showModeMenu)}
            />
          )}
          {showModeMenu && <ModeMenu mode={mode} onChange={setMode} />}
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
            void runWithDelay();
          }}
        />
      )}

      <section className="border-b border-gray-200 py-3">
        <RegisterPanel />
      </section>
      <section className="border-b border-gray-200 py-3">
        <MemoryViewer />
      </section>
    </div>
  );
}
