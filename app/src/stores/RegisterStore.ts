import { create } from "zustand";

interface Register {
    A: number;
    X: number;
    L: number;
    S: number;
    T: number;
    B: number;
    SW: number;
    PC: number;
    F: number;
}

interface RegisterState {
    A: number;
    X: number;
    L: number;
    S: number;
    T: number;
    B: number;
    SW: number;
    PC: number;
    F: number;
    setA: (value: number) => void;
    setX: (value: number) => void;
    setL: (value: number) => void;
    setS: (value: number) => void;
    setT: (value: number) => void;
    setB: (value: number) => void;
    setSW: (value: number) => void;
    setPC: (value: number) => void;
    setF: (value: number) => void;
    setAll: (value: Register) => void;
}

export const useRegisterStore = create<RegisterState>((set) => ({
    A: 0,
    X: 0,
    L: 0,
    S: 0,
    T: 0,
    B: 0,
    SW: 0,
    PC: 0,
    F: 0,
    setA: (value) => set({ A: value }),
    setX: (value) => set({ X: value }),
    setL: (value) => set({ L: value }),
    setS: (value) => set({ S: value }),
    setT: (value) => set({ T: value }),
    setB: (value) => set({ B: value }),
    setSW: (value) => set({ SW: value }),
    setPC: (value) => set({ PC: value }),
    setF: (value) => set({ F: value }),
    setAll: (value: Register) => set({ A: value.A, X: value.X, L: value.L, S: value.S, T: value.T, B: value.B, SW: value.SW, PC: value.PC, F: value.F }),
}));