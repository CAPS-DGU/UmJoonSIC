import { create } from 'zustand';

interface RunningState {
  isRunning: boolean;
  setIsRunning: (isRunning: boolean) => void;
  toggleIsRunning: () => void;
}

export const useRunningStore = create<RunningState>(set => ({
  isRunning: false,
  setIsRunning: isRunning => set({ isRunning }),
  toggleIsRunning: () => set(state => ({ isRunning: !state.isRunning })),
}));
