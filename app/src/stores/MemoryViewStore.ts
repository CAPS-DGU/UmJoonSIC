import { create } from 'zustand';

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

interface MemoryViewState {
  memoryRange: {
    start: number;
    end: number;
  };
  memoryValues: MemoryNodeData[];
  labels: MemoryLabel[];
  setMemoryRange: (memoryRange: { start: number; end: number }) => void;
  setMemoryValues: (memoryValues: MemoryNodeData[]) => void;
  setLabels: (labels: MemoryLabel[]) => void;
  updateMemoryNode: (index: number, patch: MemoryNodeData) => void;
  fetchMemoryValues: () => void;
}

export const useMemoryViewStore = create<MemoryViewState>((set, get) => ({
  memoryRange: {
    start: 0,
    end: 0,
  },
  memoryValues: [],
  labels: [],
  setMemoryRange: memoryRange => set({ memoryRange }),
  setMemoryValues: memoryValues => set({ memoryValues }),
  setLabels: labels => set({ labels }),
  updateMemoryNode: (index: number, patch: MemoryNodeData) =>
    set(state => {
      const newValues = [...state.memoryValues];
      newValues[index] = { ...newValues[index], ...patch };
      return { memoryValues: newValues };
    }),
  fetchMemoryValues: async () => {
    const { memoryRange } = get();
    const res = await fetch('http://localhost:9090/memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start: memoryRange.start,
        end: memoryRange.end,
      }),
    });
    const data = await res.json();
    set({ memoryValues: data.values });
  },
}));
