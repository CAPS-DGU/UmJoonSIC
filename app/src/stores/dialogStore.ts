// The app's one kind of dialog (AppDialog.tsx): a question with buttons, or a message with
// OK. Requests wait in turn, so two messages never stack; each resolves to the chosen
// button's value (Escape and a click outside choose the cancel value).
import { create } from 'zustand';
import { strings } from '@/i18n';

export interface DialogButton<T> {
  label: string;
  value: T;
  /** primary: the default action (Enter); danger: a destructive one; plain: the others. */
  variant?: 'primary' | 'danger' | 'plain';
}

export interface DialogRequest<T = unknown> {
  title: string;
  message?: string;
  /** Smaller text under the message (a technical detail, a path). */
  detail?: string;
  /** 'error' and 'warning' show an icon in the title. */
  tone?: 'error' | 'warning' | 'info';
  buttons: DialogButton<T>[];
  /** The value for Escape or a click outside. */
  cancelValue: T;
}

interface Pending {
  request: DialogRequest;
  resolve: (value: unknown) => void;
}

interface DialogState {
  current: Pending | null;
  queue: Pending[];
  answer: (value: unknown) => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  current: null,
  queue: [],
  answer: value => {
    const { current, queue } = get();
    if (!current) return;
    current.resolve(value);
    set({ current: queue[0] ?? null, queue: queue.slice(1) });
  },
}));

/** Ask a question; resolves to the chosen button's value. */
export function ask<T>(request: DialogRequest<T>): Promise<T> {
  return new Promise<T>(resolve => {
    const pending: Pending = {
      request: request as DialogRequest,
      resolve: resolve as (value: unknown) => void,
    };
    const { current, queue } = useDialogStore.getState();
    if (current) useDialogStore.setState({ queue: [...queue, pending] });
    else useDialogStore.setState({ current: pending });
  });
}

/** A message that needs the user's attention (something did not work), with OK. */
export function showError(title: string, message?: string, detail?: string): Promise<void> {
  return ask<void>({
    title,
    message,
    detail,
    tone: 'error',
    buttons: [{ label: strings().common.ok, value: undefined, variant: 'primary' }],
    cancelValue: undefined,
  });
}

/** Close every dialog (another project was opened: its messages no longer apply). */
export function dismissAllDialogs() {
  const { current, queue } = useDialogStore.getState();
  [current, ...queue].forEach(p => p?.resolve(p.request.cancelValue));
  useDialogStore.setState({ current: null, queue: [] });
}
