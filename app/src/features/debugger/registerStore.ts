import { create } from 'zustand';
import { simulator } from '@/api/simulator';
import type { Registers } from '@/api/types';
import { useRunningStore } from '@/features/debugger/runningStore';

const REGISTER_NAMES = ['A', 'X', 'L', 'S', 'T', 'B', 'SW', 'PC', 'F'] as const;
export type RegisterName = (typeof REGISTER_NAMES)[number];

interface RegisterState extends Registers {
  /** Registers whose value changed in the last update; the panel flashes them. */
  changedRegisters: Set<string>;
  setAll: (registers: Registers) => void;
  clearChangedRegisters: () => void;
  /** Execute one instruction and take over the resulting registers. */
  step: () => Promise<void>;
}

export const useRegisterStore = create<RegisterState>((set, get) => ({
  A: 0,
  X: 0,
  L: 0,
  S: 0,
  T: 0,
  B: 0,
  SW: 0,
  PC: 0,
  F: '0',
  changedRegisters: new Set(),

  setAll: registers =>
    set(state => ({
      A: registers.A,
      X: registers.X,
      L: registers.L,
      S: registers.S,
      T: registers.T,
      B: registers.B,
      SW: registers.SW,
      PC: registers.PC,
      F: registers.F,
      changedRegisters: new Set(REGISTER_NAMES.filter(name => state[name] !== registers[name])),
    })),

  clearChangedRegisters: () => set({ changedRegisters: new Set() }),

  step: async () => {
    const data = await simulator.step();
    if (!data.ok) {
      console.error('Failed to step');
      return;
    }
    // A PC that does not move means the program has halted (it jumps to itself).
    if (get().PC === data.registers.PC) {
      useRunningStore.getState().stopRunning();
    }
    get().setAll(data.registers);
  },
}));
