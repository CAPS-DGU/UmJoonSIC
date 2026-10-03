import { create } from 'zustand';
import { simulator } from '@/api/simulator';
import type { MachineMode } from '@/api/types';
import { useProjectStore } from '@/features/project/projectStore';

export type { MachineMode };

export type MemoryNodeStatus = 'normal' | 'highlighted' | 'red bold';

/** One byte as the viewer shows it: two hex digits, or 'ER' when loading it failed. */
export interface MemoryNodeData {
  value: string;
  status?: MemoryNodeStatus;
  isLoading?: boolean;
}

interface AddressRange {
  start: number;
  end: number;
}

/** Address space per machine mode: SIC has 32 KiB, SIC/XE has 1 MiB. */
const MEMORY_SIZE: Record<MachineMode, number> = { SIC: 0x8000, SICXE: 0x100000 };

const toHexByte = (value: number) => value.toString(16).toUpperCase().padStart(2, '0');

interface MemoryViewState {
  mode: MachineMode;
  totalMemorySize: number;
  /** The range refreshed after every step (around the program). */
  memoryRange: AddressRange;
  /** Sparse by address; bytes never requested are undefined. */
  memoryValues: MemoryNodeData[];
  /** Addresses whose value changed in the last refresh; the viewer flashes them. */
  changedNodes: Set<number>;
  loadedRanges: Set<string>;
  loadingRanges: Set<string>;

  /** Switch machine mode: clears the view and restarts the simulation in that mode. */
  setMode: (newMode: MachineMode) => void;
  setMemoryRange: (memoryRange: AddressRange) => void;
  clearChangedNodes: () => void;
  /** Re-read `memoryRange` and mark the bytes that changed. */
  fetchMemoryValues: () => Promise<void>;
  /** Load a range once; later calls for the same range are ignored. */
  loadMemoryRange: (start: number, end: number) => Promise<void>;
}

export const useMemoryViewStore = create<MemoryViewState>((set, get) => ({
  mode: 'SIC',
  totalMemorySize: MEMORY_SIZE.SIC,
  memoryRange: { start: 0, end: 256 },
  memoryValues: [],
  changedNodes: new Set(),
  loadedRanges: new Set(),
  loadingRanges: new Set(),

  setMode: newMode => {
    const totalSize = MEMORY_SIZE[newMode];
    set({
      mode: newMode,
      totalMemorySize: totalSize,
      memoryRange: { start: 0, end: totalSize - 1 },
      memoryValues: [],
      loadedRanges: new Set(),
      loadingRanges: new Set(),
      changedNodes: new Set(),
    });

    // Same request as when a run starts; not awaited.
    (async () => {
      try {
        const { settings } = useProjectStore.getState();
        const data = await simulator.begin(newMode, settings.filedevices);
        if (!data.ok) {
          console.error('Failed to begin after mode change');
        }
      } catch (e) {
        console.error('Begin request failed after mode change:', e);
      }
    })();
  },

  setMemoryRange: memoryRange => set({ memoryRange }),
  clearChangedNodes: () => set({ changedNodes: new Set() }),

  loadMemoryRange: async (start, end) => {
    if (start < 0 || start >= end) {
      return;
    }

    const rangeKey = `${start}-${end}`;
    const { loadedRanges, loadingRanges } = get();
    if (loadedRanges.has(rangeKey) || loadingRanges.has(rangeKey)) {
      return;
    }

    // Mark the range as loading, growing the array with placeholders if needed.
    set(state => {
      const mergedValues = [...state.memoryValues];
      if (mergedValues.length < end) {
        const placeholders = Array.from({ length: end - mergedValues.length }, () => ({
          value: '00',
          status: 'normal' as const,
          isLoading: false,
        }));
        mergedValues.push(...placeholders);
      }

      for (let i = start; i < end; i++) {
        if (i < mergedValues.length && (!mergedValues[i] || !mergedValues[i].isLoading)) {
          mergedValues[i] = { value: '00', status: 'normal', isLoading: true };
        }
      }

      return {
        memoryValues: mergedValues,
        loadingRanges: new Set(state.loadingRanges).add(rangeKey),
      };
    });

    try {
      const data = await simulator.memory(start, end);

      set(state => {
        const mergedValues = [...state.memoryValues];
        data.values.forEach((value, i) => {
          const address = start + i;
          if (address < mergedValues.length) {
            mergedValues[address] = { value: toHexByte(value), status: 'normal', isLoading: false };
          }
        });

        const newLoadingRanges = new Set(state.loadingRanges);
        newLoadingRanges.delete(rangeKey);
        return {
          memoryValues: mergedValues,
          loadingRanges: newLoadingRanges,
          loadedRanges: new Set(state.loadedRanges).add(rangeKey),
        };
      });
    } catch (error) {
      console.error(`메모리 범위 ${rangeKey} 로드 실패:`, error);
      set(state => {
        const mergedValues = [...state.memoryValues];
        for (let i = start; i < end; i++) {
          if (i < mergedValues.length && mergedValues[i]?.isLoading) {
            mergedValues[i] = { ...mergedValues[i], isLoading: false, value: 'ER' };
          }
        }

        const newLoadingRanges = new Set(state.loadingRanges);
        newLoadingRanges.delete(rangeKey);
        return { loadingRanges: newLoadingRanges, memoryValues: mergedValues };
      });
    }
  },

  fetchMemoryValues: async () => {
    const { memoryRange } = get();
    try {
      const data = await simulator.memory(memoryRange.start, memoryRange.end);

      set(state => {
        const mergedValues = [...state.memoryValues];
        const changedNodes = new Set<number>();
        data.values.forEach((value, i) => {
          const address = memoryRange.start + i;
          const hex = toHexByte(value);
          const oldNode = state.memoryValues[address];
          if (oldNode && oldNode.value !== hex) {
            changedNodes.add(address);
          }
          if (address < mergedValues.length) {
            mergedValues[address] = { value: hex, status: 'normal' };
          }
        });
        return { memoryValues: mergedValues, changedNodes };
      });
    } catch (error) {
      console.error('메모리 값 fetch 실패:', error);
    }
  },
}));
