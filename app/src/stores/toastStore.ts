// Short notices that do not interrupt (Toasts.tsx): "Settings saved", "The simulator was
// restarted", a warning before a run. They go away by themselves; warnings stay longer.
import { create } from 'zustand';

export interface Toast {
  id: number;
  tone: 'success' | 'info' | 'warning';
  message: string;
  /** A button in the notice (e.g. "Open the settings"). */
  action?: { label: string; run: () => void };
}

const DURATION_MS = { success: 3000, info: 4000, warning: 9000 };
const MAX_SHOWN = 3;

interface ToastState {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>(set => ({
  toasts: [],
  dismiss: id => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));

/** Show a notice; the same message is not shown twice at once. */
export function notify(tone: Toast['tone'], message: string, action?: Toast['action']) {
  const { toasts, dismiss } = useToastStore.getState();
  if (toasts.some(t => t.message === message)) return;
  const toast: Toast = { id: nextId++, tone, message, action };
  useToastStore.setState({ toasts: [...toasts, toast].slice(-MAX_SHOWN) });
  setTimeout(() => dismiss(toast.id), DURATION_MS[tone]);
}

export function dismissAllToasts() {
  useToastStore.setState({ toasts: [] });
}
