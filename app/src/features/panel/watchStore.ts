import { create } from 'zustand';
import { simulator } from '@/api/simulator';
import type { WatchVariable } from '@/api/types';

/** A watched variable of one source file, with its current bytes once fetched. */
export interface WatchRow extends WatchVariable {
  filePath: string;
  value?: number[];
}

interface WatchState {
  watch: WatchRow[];
  addWatch: (watch: WatchRow) => void;
  clearWatch: () => void;
  /** Re-read the memory behind every watched variable. */
  fetchVarMemoryValue: () => void;
}

export const useWatchStore = create<WatchState>(set => ({
  watch: [],
  addWatch: watch => set(state => ({ watch: [...state.watch, watch] })),
  clearWatch: () => set({ watch: [] }),
  fetchVarMemoryValue: () => {
    const { watch } = useWatchStore.getState();
    watch.forEach(async variable => {
      const data = await simulator.memory(
        variable.address,
        variable.address + variable.elementCount * variable.elementSize - 1,
      );
      set(state => ({
        watch: state.watch.map(row =>
          row.address === variable.address ? { ...row, value: data.values } : row,
        ),
      }));
    });
  },
}));
