import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ServerLogPayload } from '@shared/ipc';

/** One line of simulator output shown in the Server tab. */
export interface ConsoleMessage extends ServerLogPayload {
  id: string;
  timestamp: number;
}

interface ConsoleState {
  messages: ConsoleMessage[];
  addMessage: (message: ServerLogPayload) => void;
}

export const useConsoleStore = create<ConsoleState>(set => ({
  messages: [],
  addMessage: message =>
    set(state => ({
      messages: [...state.messages, { ...message, id: uuidv4(), timestamp: Date.now() }],
    })),
}));
