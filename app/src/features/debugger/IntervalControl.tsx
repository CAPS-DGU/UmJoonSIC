import { INTERVALS_MS } from '@/features/debugger/intervals';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useStrings } from '@/i18n';

/** The intervals offered (ms); the Run menu offers the same (electron/menu.ts). */
const CUSTOM = 'custom';

/**
 * The time between instructions while a program runs: a list in the toolbar, changeable at
 * any time (also during a run, where it applies to the next instruction), plus "Custom…".
 */
export function IntervalControl() {
  const t = useStrings();
  const delayTime = useRunningStore(s => s.delayTime);
  const setDelayTime = useRunningStore(s => s.setDelayTime);
  const [customOpen, setCustomOpen] = useState(false);

  const label = (ms: number) => (ms === 0 ? t.run.fastest : `${ms} ms`);
  const options = INTERVALS_MS.includes(delayTime)
    ? INTERVALS_MS
    : [...INTERVALS_MS, delayTime].sort((a, b) => a - b);

  return (
    <>
      <select
        aria-label={t.run.interval}
        title={t.run.intervalTitle}
        value={String(delayTime)}
        onChange={e => {
          if (e.target.value === CUSTOM) setCustomOpen(true);
          else setDelayTime(Number(e.target.value));
        }}
        className="h-7 w-[4.5rem] shrink-0 rounded-md border border-gray-300 bg-white px-1 text-xs text-gray-800"
      >
        {options.map(ms => (
          <option key={ms} value={String(ms)}>
            {label(ms)}
          </option>
        ))}
        <option value={CUSTOM}>{t.run.custom}</option>
      </select>
      {customOpen && (
        <CustomIntervalDialog
          initial={delayTime}
          onCancel={() => setCustomOpen(false)}
          onSave={ms => {
            setDelayTime(ms);
            setCustomOpen(false);
          }}
        />
      )}
    </>
  );
}

function CustomIntervalDialog({
  initial,
  onCancel,
  onSave,
}: {
  initial: number;
  onCancel: () => void;
  onSave: (ms: number) => void;
}) {
  const t = useStrings();
  const [input, setInput] = useState(String(initial));
  const [error, setError] = useState('');

  const submit = () => {
    const parsed = Number(input);
    if (input.trim() === '' || !Number.isFinite(parsed) || parsed < 0) {
      setError(t.run.invalidInterval);
      return;
    }
    onSave(Math.round(parsed));
  };

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t.run.customTitle}</DialogTitle>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-gray-700">{t.run.customLabel}</span>
          <Input
            type="number"
            min={0}
            autoFocus
            value={input}
            aria-invalid={!!error}
            onChange={e => {
              setInput(e.target.value);
              setError('');
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') submit();
            }}
          />
          {error && <span className="text-sm text-red-600">{error}</span>}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button onClick={submit}>{t.common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
