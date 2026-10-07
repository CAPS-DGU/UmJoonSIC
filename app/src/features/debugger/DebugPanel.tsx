import { useCallback, useEffect, useRef, useState } from 'react';
import { AppEvent } from '@shared/ipc';
import { IntervalControl } from '@/features/debugger/IntervalControl';
import MemoryViewer from '@/features/debugger/memory/MemoryViewer';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { ModeButton, ModeMenu } from '@/features/debugger/ModeMenu';
import RegisterPanel from '@/features/debugger/RegisterPanel';
import { RunToolbar } from '@/features/debugger/RunToolbar';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useProjectStore } from '@/features/project/projectStore';
import { useStrings } from '@/i18n';

/** The Run menu (F5, F6, F10, Ctrl+Shift+F5, Shift+F5 and the interval list) drives the run. */
function useRunMenu() {
  useEffect(() => {
    const store = () => useRunningStore.getState();
    const handlers: [string, (event: Event) => void][] = [
      [AppEvent.runStart, () => void store().startOrContinue()],
      [AppEvent.runPause, () => store().pause()],
      [AppEvent.runStep, () => void store().stepOrStart()],
      [AppEvent.runRestart, () => store().isRunning && void store().restart()],
      [AppEvent.runStop, () => store().isRunning && void store().stopRunning()],
      [
        AppEvent.runInterval,
        event => store().setDelayTime(Number((event as CustomEvent<number>).detail)),
      ],
    ];
    handlers.forEach(([name, handler]) => window.addEventListener(name, handler));
    return () => handlers.forEach(([name, handler]) => window.removeEventListener(name, handler));
  }, []);
}

/** Right-hand column: run toolbar, registers and memory. */
export default function DebugPanel() {
  const t = useStrings();
  // The mode stays while a program is loaded or being loaded.
  const modeLocked = useRunningStore(s => s.isRunning || s.isStarting);
  const mode = useMemoryViewStore(s => s.mode);
  const changeMode = useProjectStore(s => s.changeMode);

  const [showModeMenu, setShowModeMenu] = useState(false);
  const closeModeMenu = useCallback(() => setShowModeMenu(false), []);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useRunMenu();

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
    // Full height: the toolbar and the registers keep their size, the memory viewer takes the
    // rest and is the only part that scrolls.
    // h-full, not min-h-full: with an open height the memory viewer would grow to its content
    // (4096 rows × 32 px) and render every row. The column draws the background and border.
    <div className="flex flex-col h-full w-full">
      <section
        className="flex h-10 shrink-0 items-center justify-between gap-1.5 border-b border-gray-300 px-2"
        aria-label={t.run.panel}
      >
        {/* The panel's name, for screen readers: the toolbar needs the width. */}
        <h2 className="sr-only">{t.run.panel}</h2>
        <RunToolbar />
        <div className="relative flex items-center gap-1.5" ref={toolbarRef}>
          <IntervalControl />
          {/* Always visible: the machine the program is assembled and run for. */}
          <ModeButton
            mode={mode}
            disabled={modeLocked}
            expanded={showModeMenu && !modeLocked}
            onClick={() => setShowModeMenu(!showModeMenu)}
          />
          {showModeMenu && !modeLocked && (
            <ModeMenu
              mode={mode}
              onChange={next => void changeMode(next)}
              onClose={closeModeMenu}
            />
          )}
        </div>
      </section>

      <section className="shrink-0 border-b border-gray-200 py-3">
        <RegisterPanel />
      </section>
      <section className="flex flex-1 min-h-40 flex-col py-3">
        <MemoryViewer />
      </section>
    </div>
  );
}
