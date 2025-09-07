import { create } from 'zustand';
import axios from 'axios';
import { useWatchStore } from './pannel/WatchStore';
import type { WatchRow } from './pannel/WatchStore';

export type MemoryNodeStatus = 'normal' | 'highlighted' | 'red bold';

export interface MemoryNodeData {
  value: string;
  status?: MemoryNodeStatus;
  isLoading?: boolean;
}

export interface MemoryLabel {
  start: number;
  end: number;
  name: string;
}

export type MachineMode = 'SIC' | 'SICXE';

interface MemoryViewState {
  mode: MachineMode;
  memoryRange: {
    start: number;
    end: number;
  };
  memoryValues: MemoryNodeData[];
  labels: MemoryLabel[];
  changedNodes: Set<number>;
  visibleRange: {
    start: number;
    end: number;
  };
  totalMemorySize: number;
  loadedRanges: Set<string>;
  loadingRanges: Set<string>;

  setMode: (newMode: MachineMode) => void;
  setMemoryRange: (memoryRange: { start: number; end: number }) => void;
  setMemoryValues: (memoryValues: MemoryNodeData[]) => void;
  setLabels: (labels: MemoryLabel[]) => void;
  updateMemoryNode: (index: number, patch: Partial<MemoryNodeData>) => void;
  clearChangedNodes: () => void;
  fetchMemoryValues: () => Promise<void>;
  setVisibleRange: (range: { start: number; end: number }) => void;
  setTotalMemorySize: (size: number) => void;
  loadMemoryRange: (start: number, end: number) => Promise<void>;
  getMemoryValue: (address: number) => MemoryNodeData | null;
  getMemoryLabelFromWatch: () => MemoryLabel[];
}

export const useMemoryViewStore = create<MemoryViewState>((set, get) => ({
  mode: 'SIC',
  totalMemorySize: 0x8000,
  memoryRange: { start: 0, end: 256 },
  memoryValues: [],
  labels: [],
  changedNodes: new Set(),
  visibleRange: { start: 0, end: 256 },
  loadedRanges: new Set(),
  loadingRanges: new Set(),

  setMode: newMode => {
    const totalSize = newMode === 'SIC' ? 0x8000 : 0x100000;
    set({
      mode: newMode,
      totalMemorySize: totalSize,
      memoryRange: { start: 0, end: totalSize - 1 },
      memoryValues: [],
      loadedRanges: new Set(),
      loadingRanges: new Set(),
      changedNodes: new Set(),
      labels: [],
      visibleRange: { start: 0, end: 256 },
    });
  },

  setMemoryRange: memoryRange => set({ memoryRange }),
  setMemoryValues: memoryValues => set({ memoryValues }),
  setLabels: labels => set({ labels }),
  updateMemoryNode: (index, patch) =>
    set(state => {
      const newValues = [...state.memoryValues];
      const oldValue = newValues[index]?.value;
      newValues[index] = { ...newValues[index], ...patch } as MemoryNodeData;

      if (patch.value !== undefined && oldValue !== patch.value) {
        const newChangedNodes = new Set(state.changedNodes);
        newChangedNodes.add(index);
        return {
          memoryValues: newValues,
          changedNodes: newChangedNodes,
        };
      }

      return { memoryValues: newValues };
    }),
  clearChangedNodes: () => set({ changedNodes: new Set() }),

  setVisibleRange: visibleRange => set({ visibleRange }),
  setTotalMemorySize: totalMemorySize => set({ totalMemorySize }),

  loadMemoryRange: async (start, end) => {
    if (start < 0 || start >= end) {
      return;
    }

    const rangeKey = `${start}-${end}`;
    const currentState = get();

    if (currentState.loadedRanges.has(rangeKey) || currentState.loadingRanges.has(rangeKey)) {
      return;
    }

    set(state => {
      const newLoadingRanges = new Set(state.loadingRanges).add(rangeKey);
      const mergedValues = [...state.memoryValues];
      const requiredSize = end;

      if (mergedValues.length < requiredSize) {
        const diff = requiredSize - mergedValues.length;
        const newPlaceholders = Array.from({ length: diff }, () => ({
          value: '00',
          status: 'normal' as const,
          isLoading: false,
        }));
        mergedValues.push(...newPlaceholders);
      }

      for (let i = start; i < end; i++) {
        if (i < mergedValues.length && (!mergedValues[i] || !mergedValues[i].isLoading)) {
          mergedValues[i] = {
            value: '00',
            status: 'normal',
            isLoading: true,
          };
        }
      }

      return {
        memoryValues: mergedValues,
        loadingRanges: newLoadingRanges,
      };
    });

    try {
      const res = await axios.post('http://localhost:9090/memory', {
        start,
        end,
      });

      const data = res.data;
      const newValues = data.values.map((value: number) => ({
        value: value.toString(16).toUpperCase().padStart(2, '0'),
        status: 'normal' as const,
        isLoading: false,
      }));

      set(state => {
        const mergedValues = [...state.memoryValues];
        newValues.forEach((val: any, i: any) => {
          const globalIndex = start + i;
          if (globalIndex < mergedValues.length) {
            mergedValues[globalIndex] = val;
          }
        });

        const newLoadingRanges = new Set(state.loadingRanges);
        newLoadingRanges.delete(rangeKey);
        const newLoadedRanges = new Set(state.loadedRanges).add(rangeKey);

        return {
          memoryValues: mergedValues,
          loadingRanges: newLoadingRanges,
          loadedRanges: newLoadedRanges,
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
        return {
          loadingRanges: newLoadingRanges,
          memoryValues: mergedValues,
        };
      });
    }
  },

  getMemoryValue: address => {
    const { memoryValues } = get();
    if (address >= 0 && address < memoryValues.length) {
      return memoryValues[address];
    }
    return null;
  },

  fetchMemoryValues: async () => {
    const { memoryRange } = get();
    try {
      const res = await axios.post('http://localhost:9090/memory', {
        start: memoryRange.start,
        end: memoryRange.end,
      });
      const data = res.data;
      const newValues = data.values.map((value: number) => ({
        value: value.toString(16).toUpperCase().padStart(2, '0'),
        status: 'normal' as const,
      }));

      set(state => {
        const mergedValues = [...state.memoryValues];
        const changedNodes = new Set<number>();
        newValues.forEach((newNode: any, i: any) => {
          const globalIndex = memoryRange.start + i;
          const oldNode = state.memoryValues[globalIndex];
          if (oldNode && oldNode.value !== newNode.value) {
            changedNodes.add(globalIndex);
          }
          if (globalIndex < mergedValues.length) {
            mergedValues[globalIndex] = newNode;
          }
        });
        return { memoryValues: mergedValues, changedNodes };
      });
    } catch (error) {
      console.error('메모리 값 fetch 실패:', error);
    }
  },

  getMemoryLabelFromWatch: () => {
    const { watch } = useWatchStore.getState();
    const labels: MemoryLabel[] = [];
    watch.forEach((watchRow: WatchRow) => {
      const { address, name, elementCount, elementSize } = watchRow;
      if (typeof address === 'number' && elementCount > 0) {
        const end = address + elementSize * elementCount - 1;
        labels.push({ start: address, end, name: name });
      }
    });
    return labels;
  },
}));
