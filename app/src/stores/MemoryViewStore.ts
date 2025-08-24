import { create } from 'zustand';
import type { MemoryNodeData, MemoryLabel } from '@/types/debug/memoryData';

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
}

export const useMemoryViewStore = create<MemoryViewState>(set => ({
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
}));
