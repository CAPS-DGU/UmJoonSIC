import { create } from 'zustand';
import type { ServerLogPayload } from '@shared/ipc';

/** The Server tab keeps this many chunks of output; older ones are dropped. */
const MAX_MESSAGES = 1000;

interface ConsoleState {
  /** Simulator output, ordered by `seq`. */
  messages: ServerLogPayload[];
  /** Add output, ignoring chunks that are already there (the same `seq`). */
  addMessages: (messages: ServerLogPayload[]) => void;
}

export const useConsoleStore = create<ConsoleState>(set => ({
  messages: [],
  addMessages: incoming =>
    set(state => {
      const bySeq = new Map(state.messages.map(message => [message.seq, message]));
      for (const message of incoming) {
        bySeq.set(message.seq, message);
      }
      const messages = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
      return { messages: messages.slice(-MAX_MESSAGES) };
    }),
}));
