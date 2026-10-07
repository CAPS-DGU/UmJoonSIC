import { Pause, Play, SkipBack, Square, StepForward } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useStrings } from '@/i18n';

interface SlotProps {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  /** run: green (start, continue); stop: red; plain: the others. */
  tone?: 'run' | 'stop' | 'plain';
  children: ReactNode;
}

const TONES = {
  run: 'text-green-700 hover:bg-green-50',
  stop: 'text-red-600 hover:bg-red-50',
  plain: 'text-gray-800 hover:bg-gray-200',
};

/** One toolbar button. Disabled buttons stay in their place, so nothing moves under the mouse. */
function Slot({ title, onClick, disabled = false, tone = 'plain', children }: SlotProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-35 ${TONES[tone]}`}
    >
      {children}
    </button>
  );
}

const ICON = 'size-4';

/**
 * The run toolbar, the same five places in every state:
 *   run / continue / pause · step · restart · stop
 * Run (F5) runs the program to its end at the interval; Step (F10) loads it and stops at the
 * first instruction, then executes one instruction at a time; Stop (Shift+F5) closes the run.
 */
export function RunToolbar() {
  const t = useStrings();
  const { isRunning, isStarting, isPaused, isHalted } = useRunningStore();
  const startOrContinue = useRunningStore(s => s.startOrContinue);
  const stepOrStart = useRunningStore(s => s.stepOrStart);
  const pause = useRunningStore(s => s.pause);
  const restart = useRunningStore(s => s.restart);
  const stopRunning = useRunningStore(s => s.stopRunning);

  const autoPlaying = isRunning && !isPaused && !isHalted;
  const primary = autoPlaying
    ? {
        title: t.run.pause,
        onClick: pause,
        icon: <Pause className={ICON} />,
        tone: 'plain' as const,
      }
    : {
        title: !isRunning ? t.run.run : isHalted ? t.run.runAgain : t.run.continue,
        onClick: () => void startOrContinue(),
        icon: <Play className={`${ICON} fill-current`} />,
        tone: 'run' as const,
      };

  return (
    <div className="flex items-center gap-0.5">
      <Slot
        title={primary.title}
        onClick={primary.onClick}
        disabled={isStarting}
        tone={primary.tone}
      >
        {primary.icon}
      </Slot>
      <Slot
        title={isRunning ? t.run.step : t.run.stepStart}
        onClick={() => void stepOrStart()}
        disabled={isStarting || autoPlaying || isHalted}
      >
        <StepForward className={ICON} />
      </Slot>
      <Slot
        title={t.run.restart}
        onClick={() => void restart()}
        disabled={!isRunning || isStarting}
      >
        <SkipBack className={ICON} />
      </Slot>
      <Slot
        title={t.run.stop}
        onClick={() => void stopRunning()}
        disabled={!isRunning || isStarting}
        tone="stop"
      >
        <Square className={`${ICON} fill-current`} />
      </Slot>
    </div>
  );
}
