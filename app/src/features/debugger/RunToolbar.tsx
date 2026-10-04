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
import { useRunningStore } from '@/features/debugger/runningStore';
import { ToolbarButton } from '@/features/debugger/ToolbarButton';

const ICON = 'w-4 h-4';

interface IdleButtonsProps {
  delayTime: number;
  onOpenDelayModal: () => void;
  onToggleModeMenu: () => void;
}

/** Toolbar while no program is loaded: run with delay, delay setting, run, machine mode. */
export function IdleButtons({ delayTime, onOpenDelayModal, onToggleModeMenu }: IdleButtonsProps) {
  const run = useRunningStore(s => s.run);
  const runWithDelay = useRunningStore(s => s.runWithDelay);

  return (
    <>
      <ToolbarButton title={`지연(${delayTime}ms)으로 실행`} onClick={runWithDelay}>
        <AlarmClock className={ICON} />
      </ToolbarButton>
      <ToolbarButton title="지연 시간 설정" onClick={onOpenDelayModal}>
        <Settings className={ICON} />
      </ToolbarButton>
      <ToolbarButton title="실행" onClick={run}>
        <Play className={ICON} />
      </ToolbarButton>
      <ToolbarButton title="아키텍처 설정" onClick={onToggleModeMenu}>
        <Cpu className={ICON} />
      </ToolbarButton>
    </>
  );
}

/** Toolbar while a program is loaded: pause/continue, step, restart, stop. */
export function RunningButtons() {
  const isPaused = useRunningStore(s => s.isPaused);
  const pause = useRunningStore(s => s.pause);
  const resume = useRunningStore(s => s.resume);
  const stepOnce = useRunningStore(s => s.stepOnce);
  const restart = useRunningStore(s => s.restart);
  const stopRunning = useRunningStore(s => s.stopRunning);

  return (
    <>
      {isPaused ? (
        <ToolbarButton title="Continue" onClick={resume}>
          <StepForward className={ICON} />
        </ToolbarButton>
      ) : (
        <ToolbarButton title="Pause" onClick={pause}>
          <Pause className={ICON} />
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
      <ToolbarButton title="실행 중지" onClick={stopRunning}>
        <Square className={ICON} />
      </ToolbarButton>
    </>
  );
}
