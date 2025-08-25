import { create } from 'zustand';

export interface WatchRow {
  filePath: string;
  name: string;
  address: number;
  dataType: string;
  elementSize: number;
  elementCount: number;
}

interface WatchState {
  watch: WatchRow[];
  setWatch: (watch: WatchRow[]) => void;
  addWatch: (watch: WatchRow) => void;
}

export const useWatchStore = create<WatchState>(set => ({
  watch: [],
  setWatch: watch => set({ watch }),
  addWatch: (watch: WatchRow) => set(state => ({ watch: [...state.watch, watch] })),
}));
