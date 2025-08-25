import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ConsoleMessage } from '@/types/ConsoleMessage';

interface ConsoleState {
  messages: ConsoleMessage[];
  addMessage: (message: Omit<ConsoleMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
}

const useConsoleStore = create<ConsoleState>(set => ({
  messages: [],
  addMessage: message =>
    set(state => ({
      messages: [...state.messages, { ...message, id: uuidv4(), timestamp: Date.now() }],
    })),
  clearMessages: () => set({ messages: [] }),
}));

export default useConsoleStore;
