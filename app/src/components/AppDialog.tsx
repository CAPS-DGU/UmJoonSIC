import { AlertTriangle, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDialogStore } from '@/stores/dialogStore';

/** The current dialog of dialogStore: a message or a question, the same look everywhere. */
export function AppDialog() {
  const current = useDialogStore(s => s.current);
  const answer = useDialogStore(s => s.answer);
  if (!current) return null;
  const { title, message, detail, tone, buttons, cancelValue } = current.request;

  return (
    <Dialog open onOpenChange={open => !open && answer(cancelValue)}>
      <DialogContent className="sm:max-w-md" aria-describedby={message ? undefined : undefined}>
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            {tone === 'error' && <CircleX className="size-5 shrink-0 text-red-600" aria-hidden />}
            {tone === 'warning' && (
              <AlertTriangle className="size-5 shrink-0 text-amber-700" aria-hidden />
            )}
            <span className="min-w-0">{title}</span>
          </DialogTitle>
          {message && (
            <DialogDescription className="whitespace-pre-line text-gray-700 [overflow-wrap:anywhere]">
              {message}
            </DialogDescription>
          )}
          {detail && (
            <p className="whitespace-pre-line font-mono text-xs text-gray-600 [overflow-wrap:anywhere]">
              {detail}
            </p>
          )}
        </DialogHeader>
        <DialogFooter>
          {buttons.map((button, i) => (
            <Button
              key={i}
              autoFocus={button.variant === 'primary'}
              variant={
                button.variant === 'danger'
                  ? 'destructive'
                  : button.variant === 'primary'
                    ? 'default'
                    : 'outline'
              }
              onClick={() => answer(button.value)}
            >
              {button.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
