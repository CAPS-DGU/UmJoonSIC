import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInfoModalStore } from '@/stores/infoModalStore';

/** A message with an OK button (open file failed, linker error, ...), like the other dialogs. */
export function InfoModal() {
  const { isOpen, title, message, close } = useInfoModalStore(
    useShallow(s => ({ isOpen: s.isOpen, title: s.title, message: s.message, close: s.close })),
  );

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="min-w-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line [overflow-wrap:anywhere]">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button autoFocus onClick={close}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
