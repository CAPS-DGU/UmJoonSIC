import { create } from 'zustand';
import { useRunningStore } from './RunningStore';

interface Register {
  A: number;
  X: number;
  L: number;
  S: number;
  T: number;
  B: number;
  SW: number;
  PC: number;
  F: string;
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
  F: string;
  getFHex: () => string;
  changedRegisters: Set<string>; // 변경된 레지스터 추적
  setA: (value: number) => void;
  setX: (value: number) => void;
  setL: (value: number) => void;
  setS: (value: number) => void;
  setT: (value: number) => void;
  setB: (value: number) => void;
  setSW: (value: number) => void;
  setPC: (value: number) => void;
  setF: (value: string) => void;
  setAll: (value: Register) => void;
  fetchRegisters: () => void;
  clearChangedRegisters: () => void; // 변경 표시 초기화
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
  F: "0",
  changedRegisters: new Set(),
  setA: value => set(state => ({ 
    A: value, 
    changedRegisters: new Set([...state.changedRegisters, 'A']) 
  })),
  setX: value => set(state => ({ 
    X: value, 
    changedRegisters: new Set([...state.changedRegisters, 'X']) 
  })),
  setL: value => set(state => ({ 
    L: value, 
    changedRegisters: new Set([...state.changedRegisters, 'L']) 
  })),
  setS: value => set(state => ({ 
    S: value, 
    changedRegisters: new Set([...state.changedRegisters, 'S']) 
  })),
  setT: value => set(state => ({ 
    T: value, 
    changedRegisters: new Set([...state.changedRegisters, 'T']) 
  })),
  setB: value => set(state => ({ 
    B: value, 
    changedRegisters: new Set([...state.changedRegisters, 'B']) 
  })),
  setSW: value => set(state => ({ 
    SW: value, 
    changedRegisters: new Set([...state.changedRegisters, 'SW']) 
  })),
  setPC: value => set(state => ({ 
    PC: value, 
    changedRegisters: new Set([...state.changedRegisters, 'PC']) 
  })),
  setF: value => set(state => ({ 
    F: value, 
    changedRegisters: new Set([...state.changedRegisters, 'F']) 
  })),
  setAll: (value: Register) =>
    set(state => {
      const changedRegs = new Set<string>();
      if (state.A !== value.A) changedRegs.add('A');
      if (state.X !== value.X) changedRegs.add('X');
      if (state.L !== value.L) changedRegs.add('L');
      if (state.S !== value.S) changedRegs.add('S');
      if (state.T !== value.T) changedRegs.add('T');
      if (state.B !== value.B) changedRegs.add('B');
      if (state.SW !== value.SW) changedRegs.add('SW');
      if (state.PC !== value.PC) changedRegs.add('PC');
      if (state.F !== value.F) changedRegs.add('F');
      
      return {
        A: value.A,
        X: value.X,
        L: value.L,
        S: value.S,
        T: value.T,
        B: value.B,
        SW: value.SW,
        PC: value.PC,
        F: value.F,
        changedRegisters: changedRegs,
      };
    }),
    getFHex: () => {
      const fStr = get().F;
      const parsed = Number(fStr);
      if (!Number.isFinite(parsed) || parsed === 0) {
        return '0x000000000000';
      }

      const sign = parsed < 0 ? 1 : 0;
      let value = Math.abs(parsed);

      // 정규화: value = 1.x * 2^exp
      let exp = Math.floor(Math.log2(value));
      let mantissa = value / Math.pow(2, exp); // 1 <= mantissa < 2
      const fraction = mantissa - 1; // [0, 1)

      // 32비트 fraction으로 반올림
      let fractionBits = Math.round(fraction * Math.pow(2, 32));
      if (fractionBits === Math.pow(2, 32)) {
        // 반올림으로 인해 1.000.. 이 되는 경우 지수 올림
        fractionBits = 0;
        exp += 1;
      }

      const EXP_BITS = 15;
      const EXP_BIAS = Math.pow(2, EXP_BITS - 1) - 1; // 16383
      let biased = exp + EXP_BIAS;

      if (biased <= 0) {
        // 언더플로우는 0으로 처리
        return '0x000000000000';
      }
      if (biased >= (1 << EXP_BITS)) {
        // 오버플로우는 최대 유한값으로 포화
        const maxBits = (BigInt(sign) << 47n) | (BigInt((1 << EXP_BITS) - 2) << 32n) | 0xFFFFFFFFn;
        return '0x' + maxBits.toString(16).toUpperCase().padStart(12, '0');
      }

      const bits = (BigInt(sign) << 47n) | (BigInt(biased) << 32n) | BigInt(fractionBits >>> 0);
      return '0x' + bits.toString(16).toUpperCase().padStart(12, '0');
    },
  clearChangedRegisters: () => set({ changedRegisters: new Set() }),
  fetchRegisters: async () => {
    const res = await fetch('http://localhost:9090/step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.ok) {
      const registers = data.registers;
      const { PC } = get();
      if (PC === registers.PC) {
        const { stopRunning } = useRunningStore.getState();
        stopRunning();
      }

      // setAll을 사용하여 변경된 레지스터 추적
      const { setAll } = get();
      setAll(registers);
      console.log(registers);
    } else {
      console.error('Failed to fetch registers');
    }
  },
}));
