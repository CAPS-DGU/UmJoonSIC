// The memory the last store instruction wrote (STA, STX, STL, STCH, STB, STS, STT, STF, STSW),
// for "jump to the last write" in the memory viewer. The simulator is not asked: the run
// engine knows the PC and the registers before each instruction, and the listing gives the
// instruction's bytes, from which its target address is worked out as the machine does.
import { create } from 'zustand';
import type { ListingRow, MachineMode, Registers } from '@/api/types';

/** Bytes each store instruction writes, by opcode. */
const STORE_SIZE: Record<number, number> = {
  0x0c: 3, // STA
  0x10: 3, // STX
  0x14: 3, // STL
  0x54: 1, // STCH
  0x78: 3, // STB
  0x7c: 3, // STS
  0x80: 6, // STF
  0x84: 3, // STT
  0xe8: 3, // STSW
};

export interface LastWrite {
  /** Where the bytes went; for an indirect store (STA @P), where the address was read from. */
  address: number;
  size: number;
  indirect: boolean;
  /** The instruction, as in the listing (e.g. "STA LAST"), and its address. */
  instruction: string;
  pc: number;
  /** Counts the writes, so that the same address written again is a new one. */
  count: number;
}

export const useLastWriteStore = create<{ last: LastWrite | null }>(() => ({ last: null }));

let code = new Map<number, { bytes: number[]; text: string }>();
let count = 0;

/** A program was loaded: the instructions of its listings, by address. */
export function startWriteTracking(listings: ListingRow[][]) {
  code = new Map();
  for (const row of listings.flat()) {
    const hex = row.rawCodeHex.replaceAll(' ', '');
    if (row.isCommentRow || hex.length < 6) continue;
    const bytes = hex.match(/../g)!.map(b => parseInt(b, 16));
    code.set(parseInt(row.addressHex, 16), {
      bytes,
      text: [row.instr, row.operand].filter(Boolean).join(' '),
    });
  }
  count = 0;
  useLastWriteStore.setState({ last: null });
}

export function clearWriteTracking() {
  code = new Map();
  useLastWriteStore.setState({ last: null });
}

/**
 * The target of a store instruction (its bytes), as the machine computes it from the
 * registers before it runs; null if it is not a store or writes no memory.
 */
export function storeTarget(
  bytes: number[],
  pc: number,
  registers: Pick<Registers, 'X' | 'B'>,
  mode: MachineMode,
): { address: number; size: number; indirect: boolean } | null {
  const size = STORE_SIZE[bytes[0] & 0xfc];
  if (!size || bytes.length < 3) return null;
  const ni = mode === 'SIC' ? 0 : bytes[0] & 3;
  const indexed = (bytes[1] & 0x80) !== 0;
  let address: number;
  if (ni === 0) {
    // SIC format: 15-bit address.
    address = ((bytes[1] & 0x7f) << 8) | bytes[2];
  } else if (bytes[1] & 0x10) {
    // Format 4: 20-bit address.
    if (bytes.length < 4) return null;
    address = ((bytes[1] & 0x0f) << 16) | (bytes[2] << 8) | bytes[3];
  } else {
    let disp = ((bytes[1] & 0x0f) << 8) | bytes[2];
    if (bytes[1] & 0x20) {
      if (disp & 0x800) disp -= 0x1000;
      address = pc + 3 + disp; // PC-relative: from the next instruction
    } else if (bytes[1] & 0x40) {
      address = registers.B + disp;
    } else {
      address = disp;
    }
  }
  if (indexed) address += registers.X;
  // Immediate (n=0, i=1): no memory is written.
  if (ni === 1) return null;
  const mask = mode === 'SIC' ? 0x7fff : 0xfffff;
  return { address: address & mask, size, indirect: ni === 2 };
}

/** One executed instruction: if it stored to memory, remember where. */
export function recordWrite(pc: number, before: Registers, mode: MachineMode) {
  const instruction = code.get(pc);
  if (!instruction) return;
  const target = storeTarget(instruction.bytes, pc, before, mode);
  if (!target) return;
  useLastWriteStore.setState({
    last: { ...target, instruction: instruction.text, pc, count: ++count },
  });
}
