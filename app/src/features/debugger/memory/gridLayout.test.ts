import { describe, expect, it } from 'vitest';
import { addressDigits, gridWidth } from '@/features/debugger/memory/gridLayout';

describe('addressDigits', () => {
  it('is 4 for SIC (32 KiB) and 5 for SIC/XE (1 MiB)', () => {
    expect(addressDigits(0x8000)).toBe(4);
    expect(addressDigits(0x100000)).toBe(5);
  });

  it('is never less than 4', () => {
    expect(addressDigits(16)).toBe(4);
  });
});

describe('gridWidth', () => {
  it('is the address, 8 cells of 3 characters, the gaps and the dividing line', () => {
    expect(gridWidth(4)).toBe('calc(28ch + 1rem + 1px)');
    expect(gridWidth(5)).toBe('calc(29ch + 1rem + 1px)');
  });
});
