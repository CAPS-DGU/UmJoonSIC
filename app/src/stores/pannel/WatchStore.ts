import { create } from 'zustand';

export interface WatchRow {
  name: string;
  address: number;
  dataType: string;
  elementSize: number;
  elementCount: number;
}

interface WatchState {
  watch: WatchRow[];
  setWatch: (watch: WatchRow[]) => void;
}

export const useWatchStore = create<WatchState>(set => ({
  watch: [],
  setWatch: watch => set({ watch }),
}));
