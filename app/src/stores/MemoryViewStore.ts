import { create } from 'zustand';
import axios from 'axios';
import { useWatchStore } from './pannel/WatchStore';
import type { WatchRow } from './pannel/WatchStore';

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

  // 무한 스크롤을 위한 상태
  visibleRange: {
    start: number;
    end: number;
  };
  totalMemorySize: number; // 전체 메모리 크기 (예: 65536)
  loadedRanges: Set<string>; // 이미 로드된 범위들 (예: "0-255", "256-511")

  setMemoryRange: (memoryRange: { start: number; end: number }) => void;
  setMemoryValues: (memoryValues: MemoryNodeData[]) => void;
  setLabels: (labels: MemoryLabel[]) => void;
  updateMemoryNode: (index: number, patch: MemoryNodeData) => void;
  clearChangedNodes: () => void; // 변경된 노드 목록 초기화
  fetchMemoryValues: () => void;

  // 무한 스크롤 관련 함수들
  setVisibleRange: (range: { start: number; end: number }) => void;
  setTotalMemorySize: (size: number) => void;
  loadMemoryRange: (start: number, end: number) => Promise<void>;
  getMemoryValue: (address: number) => MemoryNodeData | null;
  getMemoryLabelFromWatch: () => MemoryLabel[];
}

export const useMemoryViewStore = create<MemoryViewState>((set, get) => ({
  memoryRange: {
    start: 0,
    end: 256,
  },
  memoryValues: [],
  labels: [],
  changedNodes: new Set(),

  // 무한 스크롤 상태
  visibleRange: {
    start: 0,
    end: 256,
  },
  totalMemorySize: 65536, // 64KB 메모리
  loadedRanges: new Set(),

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
          changedNodes: newChangedNodes,
        };
      }

      return { memoryValues: newValues };
    }),
  clearChangedNodes: () => set({ changedNodes: new Set() }),

  setVisibleRange: visibleRange => set({ visibleRange }),
  setTotalMemorySize: totalMemorySize => set({ totalMemorySize }),

  // 특정 메모리 범위 로드
  loadMemoryRange: async (start: number, end: number) => {
    const { loadedRanges } = get();
    const rangeKey = `${start}-${end}`;

    // 이미 로드된 범위인지 확인
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

        // 기존 메모리 값들과 병합
        const mergedValues = [...state.memoryValues];

        // 필요한 크기만큼 배열 확장
        const requiredSize = end + 1;
        while (mergedValues.length < requiredSize) {
          mergedValues.push({
            value: '00',
            status: 'normal',
          });
        }

        // 새로운 값들로 업데이트
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

      // 에러 시 테스트용 더미 데이터 생성
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

        // 테스트용 패턴 데이터 생성
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

  // 특정 주소의 메모리 값 가져오기
  getMemoryValue: (address: number) => {
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
      changedNodes,
    });
  },
  getMemoryLabelFromWatch: () => {
    const { watch } = useWatchStore();
    const labels: MemoryLabel[] = [];
    watch.forEach((watch: WatchRow) => {
      const { address, name, dataType, elementSize, elementCount } = watch;
      const end = address + elementSize * elementCount - 1;
      labels.push({ start: address, end, name: name });
    });

    return labels;
  },
}));
