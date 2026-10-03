import {
  AlarmClock,
  Cpu,
  Pause,
  Play,
  Redo,
  RotateCcw,
  Settings,
  Square,
  StepForward,
} from 'lucide-react';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useRunningStore } from '@/features/debugger/runningStore';
import { ToolbarButton } from '@/features/debugger/ToolbarButton';
import { useWatchStore } from '@/features/panel/watchStore';

const ICON = 'w-4 h-4';

/** Delay used when auto-play is resumed with Continue. */
const CONTINUE_DELAY_MS = 1000;

interface IdleButtonsProps {
  delayTime: number;
  onRun: () => void;
  onRunWithDelay: (delayTime: number) => void;
  onOpenDelayModal: () => void;
  onToggleModeMenu: () => void;
}

/** Toolbar while no program is loaded: run with delay, delay setting, run, machine mode. */
export function IdleButtons({
  delayTime,
  onRun,
  onRunWithDelay,
  onOpenDelayModal,
  onToggleModeMenu,
}: IdleButtonsProps) {
  return (
    <>
      <ToolbarButton
        title={`지연(${delayTime || 1000}ms)으로 실행`}
        onClick={() => onRunWithDelay(delayTime || 1000)}
      >
        <AlarmClock className={ICON} />
      </ToolbarButton>
      <ToolbarButton title="지연 시간 설정" onClick={onOpenDelayModal}>
        <Settings className={ICON} />
      </ToolbarButton>
      <ToolbarButton title="실행" onClick={onRun}>
        <Play className={ICON} />
      </ToolbarButton>
      <ToolbarButton title="아키텍처 설정" onClick={onToggleModeMenu}>
        <Cpu className={ICON} />
      </ToolbarButton>
    </>
  );
}

interface RunningButtonsProps {
  /** Resume auto-play without reloading the program. */
  onContinue: (delayTime: number) => void;
  onStopped: () => void;
}

/** Toolbar while a program is loaded: pause/continue, step, restart, stop. */
export function RunningButtons({ onContinue, onStopped }: RunningButtonsProps) {
  const step = useRegisterStore(s => s.step);
  const fetchMemory = useMemoryViewStore(s => s.fetchMemoryValues);
  const stopRunning = useRunningStore(s => s.stopRunning);
  const loadProgram = useRunningStore(s => s.loadProgram);
  const toggleIsRunning = useRunningStore(s => s.toggleIsRunning);
  const fetchVarMemoryValue = useWatchStore(s => s.fetchVarMemoryValue);

  // NOTE: read without subscribing, as before. The toolbar therefore reflects a pause only
  // when something else re-renders it (in practice: the next memory refresh).
  const { isPaused, setIsPaused } = useRunningStore.getState();

  const stepOnce = () => {
    step();
    fetchMemory();
    fetchVarMemoryValue();
  };

  const restart = async () => {
    await stopRunning();
    await loadProgram();
    toggleIsRunning();
    setIsPaused(true);
  };

  return (
    <>
      {!isPaused ? (
        <ToolbarButton title="Pause" onClick={() => setIsPaused(true)}>
          <Pause className={ICON} />
        </ToolbarButton>
      ) : (
        <ToolbarButton
          title="Continue"
          onClick={() => {
            setIsPaused(false);
            onContinue(CONTINUE_DELAY_MS);
          }}
        >
          <StepForward className={ICON} />
        </ToolbarButton>
      )}
      {isPaused && (
        <ToolbarButton title="Step Over" onClick={stepOnce}>
          <Redo className={ICON} />
        </ToolbarButton>
      )}
      <ToolbarButton title="재실행" onClick={restart}>
        <RotateCcw className={ICON} />
      </ToolbarButton>
      <ToolbarButton
        title="실행 중지"
        onClick={() => {
          stopRunning();
          onStopped();
        }}
      >
        <Square className={ICON} />
      </ToolbarButton>
    </>
  );
}
