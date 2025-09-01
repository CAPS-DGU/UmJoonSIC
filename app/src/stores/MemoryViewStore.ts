import { create } from 'zustand';
import axios from 'axios';

export type MemoryNodeStatus = 'normal' | 'highlighted' | 'red bold';

export interface MemoryNodeData {
  value: string; // 실제 값 (0~255)
  status?: MemoryNodeStatus; // 표시 상태
}

export interface MemoryLabel {
  start: number;
  end: number;
  name: string;
}

// SIC, SIC/XE 모드를 위한 타입 정의
export type MachineMode = 'SIC' | 'SICXE';

interface MemoryViewState {
  // --- 새로 추가된 상태 ---
  mode: MachineMode; // 현재 머신 모드

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

  // --- 새로 추가된 액션 ---
  setMode: (newMode: MachineMode) => void;

  setMemoryRange: (memoryRange: { start: number; end: number }) => void;
  setMemoryValues: (memoryValues: MemoryNodeData[]) => void;
  setLabels: (labels: MemoryLabel[]) => void;
  updateMemoryNode: (index: number, patch: MemoryNodeData) => void;
  clearChangedNodes: () => void;
  fetchMemoryValues: () => void;

  setVisibleRange: (range: { start: number; end: number }) => void;
  setTotalMemorySize: (size: number) => void;
  loadMemoryRange: (start: number, end: number) => Promise<void>;
  getMemoryValue: (address: number) => MemoryNodeData | null;
}

export const useMemoryViewStore = create<MemoryViewState>((set, get) => ({
  // --- 기본값을 SIC 모드 기준으로 변경 ---
  mode: 'SIC',
  totalMemorySize: 0x8000, // 32KB (SIC 메모리 크기)

  memoryRange: {
    start: 0,
    end: 256,
  },
  memoryValues: [],
  labels: [],
  changedNodes: new Set(),

  visibleRange: {
    start: 0,
    end: 256,
  },
  loadedRanges: new Set(),

  // --- 모드 변경 액션 구현 ---
  setMode: newMode => {
    const totalSize = newMode === 'SIC' ? 0x8000 : 0x100000;
    set({
      mode: newMode,
      totalMemorySize: totalSize,
      memoryRange: { start: 0, end: totalSize - 1 },
      memoryValues: [],
      loadedRanges: new Set(),
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
      newValues[index] = { ...newValues[index], ...patch };

      if (oldValue !== patch.value) {
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
    const { loadedRanges } = get();
    const rangeKey = `${start}-${end}`;

    if (loadedRanges.has(rangeKey)) {
      return;
    }

    try {
      const res = await axios.post('http://localhost:9090/memory', {
        start,
        end,
      });

      const data = res.data;
      const newValues = data.values.map((value: number) => ({
        value: value.toString(16).toUpperCase().padStart(2, '0'),
        status: 'normal',
      }));

      set(state => {
        const newLoadedRanges = new Set(state.loadedRanges);
        newLoadedRanges.add(rangeKey);
        const mergedValues = [...state.memoryValues];
        const requiredSize = end + 1;
        while (mergedValues.length < requiredSize) {
          mergedValues.push({
            value: '00',
            status: 'normal',
          });
        }

        for (let i = 0; i < newValues.length; i++) {
          const globalIndex = start + i;
          if (globalIndex < mergedValues.length) {
            mergedValues[globalIndex] = newValues[i];
          }
        }

        console.log(`메모리 범위 로드: ${start}-${end}, 로드된 값들:`, newValues.slice(0, 5));

        return {
          memoryValues: mergedValues,
          loadedRanges: newLoadedRanges,
        };
      });
    } catch (error) {
      console.error('메모리 범위 로드 실패:', error);

      set(state => {
        const newLoadedRanges = new Set(state.loadedRanges);
        newLoadedRanges.add(rangeKey);
        const mergedValues = [...state.memoryValues];
        const requiredSize = end + 1;
        while (mergedValues.length < requiredSize) {
          mergedValues.push({
            value: '00',
            status: 'normal',
          });
        }

        for (let i = 0; i < end - start + 1; i++) {
          const globalIndex = start + i;
          if (globalIndex < mergedValues.length) {
            mergedValues[globalIndex] = {
              value: (globalIndex % 256).toString(16).toUpperCase().padStart(2, '0'),
              status: 'normal',
            };
          }
        }

        return {
          memoryValues: mergedValues,
          loadedRanges: newLoadedRanges,
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
    const { memoryRange, memoryValues } = get();
    const res = await axios.post('http://localhost:9090/memory', {
      start: memoryRange.start,
      end: memoryRange.end,
    });
    console.log(res);
    const data = res.data;

    const newValues = data.values.map((value: number) => ({
      value: value.toString(16).toUpperCase().padStart(2, '0'),
      status: 'normal',
    }));

    const changedNodes = new Set<number>();
    newValues.forEach((newNode: MemoryNodeData, index: number) => {
      const oldNode = memoryValues[index];
      if (oldNode && oldNode.value !== newNode.value) {
        changedNodes.add(index);
      }
    });

    set({
      memoryValues: newValues,
      changedNodes,
    });
  },
}));
