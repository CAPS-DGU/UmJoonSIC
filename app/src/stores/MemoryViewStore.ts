import { create } from "zustand";



interface MemoryViewState {
    memoryRange: {
        start: number;
        end: number;
    };
    memoryValues: number[];
    setMemoryRange: (memoryRange: { start: number; end: number }) => void;
    setMemoryValues: (memoryValues: number[]) => void;
}

export const useMemoryViewStore = create<MemoryViewState>((set) => ({
    memoryRange: {
        start: 0,
        end: 0,
    },
    memoryValues: [],
    setMemoryRange: (memoryRange) => set({ memoryRange }),
    setMemoryValues: (memoryValues) => set({ memoryValues }),
}));