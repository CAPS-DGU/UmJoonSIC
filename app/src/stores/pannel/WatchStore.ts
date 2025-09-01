import { create } from 'zustand';
import axios from 'axios';

export interface WatchRow {
  filePath: string;
  name: string;
  address: number;
  dataType: string;
  elementSize: number;
  elementCount: number;
  value?: number[];
}

interface WatchState {
  watch: WatchRow[];
  setWatch: (watch: WatchRow[]) => void;
  addWatch: (watch: WatchRow) => void;
  clearWatch: () => void;
  fetchVarMemoryValue: () => void;
}

export const useWatchStore = create<WatchState>(set => ({
  watch: [],
  setWatch: watch => set({ watch }),
  addWatch: (watch: WatchRow) => set(state => ({ watch: [...state.watch, watch] })),
  clearWatch: () => set({ watch: [] }),
  fetchVarMemoryValue: () => {
    const { watch } = useWatchStore.getState();
    watch.forEach(async w => {
      const res = await axios.post(`http://localhost:9090/memory`, {
        start: w.address,
        end: w.address + w.elementCount * w.elementSize -1,
      });
      console.log(res.data);
      set(state => ({
        watch: state.watch.map(ww => w.address === ww.address ? { ...ww, value: res.data.values } : ww),
      }));
    });
  },
}));
