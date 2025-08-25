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

interface MemoryViewState {
  memoryRange: {
    start: number;
    end: number;
  };
  memoryValues: MemoryNodeData[];
  labels: MemoryLabel[];
  changedNodes: Set<number>; // 변경된 노드 인덱스 추적
  setMemoryRange: (memoryRange: { start: number; end: number }) => void;
  setMemoryValues: (memoryValues: MemoryNodeData[]) => void;
  setLabels: (labels: MemoryLabel[]) => void;
  updateMemoryNode: (index: number, patch: MemoryNodeData) => void;
  clearChangedNodes: () => void; // 변경된 노드 목록 초기화
  fetchMemoryValues: () => void;
}

export const useMemoryViewStore = create<MemoryViewState>((set, get) => ({
  memoryRange: {
    start: 0,
    end: 256,
  },
  memoryValues: [],
  labels: [],
  changedNodes: new Set(),
  setMemoryRange: memoryRange => set({ memoryRange }),
  setMemoryValues: memoryValues => set({ memoryValues }),
  setLabels: labels => set({ labels }),
  updateMemoryNode: (index: number, patch: MemoryNodeData) =>
    set(state => {
      const newValues = [...state.memoryValues];
      const oldValue = newValues[index]?.value;
      newValues[index] = { ...newValues[index], ...patch };
      
      // 값이 실제로 변경되었는지 확인
      if (oldValue !== patch.value) {
        const newChangedNodes = new Set(state.changedNodes);
        newChangedNodes.add(index);
        return { 
          memoryValues: newValues,
          changedNodes: newChangedNodes
        };
      }
      
      return { memoryValues: newValues };
    }),
  clearChangedNodes: () => set({ changedNodes: new Set() }),
  fetchMemoryValues: async () => {
    const { memoryRange, memoryValues } = get();
    const res = await axios.post('http://localhost:9090/memory', {
      start: memoryRange.start,
      end: memoryRange.end,
    });
    console.log(res);
    const data = res.data;
    
    // 이전 값들과 비교하여 변경된 노드 찾기
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
      changedNodes
    });
  },
}));
