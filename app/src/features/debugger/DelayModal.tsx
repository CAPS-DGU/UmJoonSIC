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

interface DelayModalProps {
  /** Current delay in ms, shown as the initial value. */
  delayTime: number;
  onCancel: () => void;
  onSave: (delayTime: number) => void;
  onSaveAndRun: (delayTime: number) => void;
}

/**
 * Dialog for the delay between instructions of the "run with delay" button. Built like the
 * app's other dialogs: Escape or a click outside cancels, Enter saves.
 */
export function DelayModal({ delayTime, onCancel, onSave, onSaveAndRun }: DelayModalProps) {
  const [input, setInput] = useState(String(delayTime));

  /** Call `action` with the entered delay, unless it is not a non-negative number. */
  const submit = (action: (delayTime: number) => void) => {
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    action(parsed);
  };

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>지연 시간(ms)을 입력하세요</DialogTitle>
        </DialogHeader>
        <Input
          type="number"
          min={0}
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit(onSave);
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button variant="secondary" onClick={() => submit(onSaveAndRun)}>
            저장 후 실행
          </Button>
          {/* the default action, as Enter */}
          <Button onClick={() => submit(onSave)}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
