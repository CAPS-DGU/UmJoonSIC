import { create } from 'zustand';
import type { ServerLogPayload } from '@shared/ipc';

/** The Server tab keeps this many chunks of output; older ones are dropped. */
const MAX_MESSAGES = 1000;

/** A line of the panel: simulator output, or a line of the app's own about a run ('run'). */
export interface ConsoleLine {
  seq: number;
  type: ServerLogPayload['type'] | 'run';
  message: string;
}

interface ConsoleState {
  /** Simulator output and run lines, ordered by `seq`. */
  messages: ConsoleLine[];
  /** Add output, ignoring chunks that are already there (the same `seq`). */
  addMessages: (messages: ServerLogPayload[]) => void;
  /** A line of the app's own ("Halted at ..."), after the output so far. */
  addRunLine: (message: string) => void;
}

export const useConsoleStore = create<ConsoleState>(set => ({
  messages: [],
  addRunLine: message =>
    set(state => {
      const last = state.messages.at(-1)?.seq ?? 0;
      // Between the last output's seq and the next one's (main numbers them 1, 2, 3 ...).
      return {
        messages: [...state.messages, { seq: last + 0.001, type: 'run' as const, message }].slice(
          -MAX_MESSAGES,
        ),
      };
    }),
  addMessages: incoming =>
    set(state => {
      const bySeq = new Map<number, ConsoleLine>(
        state.messages.map(message => [message.seq, message]),
      );
      for (const message of incoming) {
        bySeq.set(message.seq, message);
      }
      const messages = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
      return { messages: messages.slice(-MAX_MESSAGES) };
    }),
}));
