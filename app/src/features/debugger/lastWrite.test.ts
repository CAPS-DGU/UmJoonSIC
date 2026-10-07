import { describe, expect, it } from 'vitest';
import { storeTarget } from './lastWrite';

const regs = { X: 6, B: 0x1000 };

describe('the target of a store instruction', () => {
  it('SIC: 15-bit address, indexed with X', () => {
    expect(storeTarget([0x0c, 0x10, 0x2a], 0, regs, 'SIC')).toEqual({
      address: 0x102a,
      size: 3,
      indirect: false,
    });
    expect(storeTarget([0x54, 0x90, 0x00], 0, regs, 'SIC')).toEqual({
      address: 0x1006,
      size: 1,
      indirect: false,
    });
  });

  it('SIC/XE: PC-relative (signed), base-relative, format 4', () => {
    // STA with p=1, disp +0x10 from PC 0x100: 0x103 + 0x10.
    expect(storeTarget([0x0f, 0x20, 0x10], 0x100, regs, 'SICXE')?.address).toBe(0x113);
    // Negative displacement 0xFFD = -3.
    expect(storeTarget([0x0f, 0x2f, 0xfd], 0x100, regs, 'SICXE')?.address).toBe(0x100);
    expect(storeTarget([0x0f, 0x40, 0x20], 0, regs, 'SICXE')?.address).toBe(0x1020);
    expect(storeTarget([0x0f, 0x10, 0x20, 0x00], 0, regs, 'SICXE')?.address).toBe(0x02000);
    // STF writes 6 bytes; indirect (n=1, i=0) is marked.
    expect(storeTarget([0x83, 0x20, 0x00], 0, regs, 'SICXE')?.size).toBe(6);
    expect(storeTarget([0x0e, 0x20, 0x00], 0, regs, 'SICXE')?.indirect).toBe(true);
  });

  it('is none for other instructions and immediate operands', () => {
    expect(storeTarget([0x00, 0x20, 0x00], 0, regs, 'SICXE')).toBeNull(); // LDA
    expect(storeTarget([0x0d, 0x00, 0x05], 0, regs, 'SICXE')).toBeNull(); // STA #5
  });
});
