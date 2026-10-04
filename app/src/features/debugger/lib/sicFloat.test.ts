import { describe, expect, it } from 'vitest';
import { toSicFloatHex } from '@/features/debugger/lib/sicFloat';

describe('toSicFloatHex: 1 sign bit, 15 exponent bits (bias 16383), 32 fraction bits', () => {
  it.each([
    ['0', '0x000000000000'],
    ['1', '0x3FFF00000000'],
    ['2', '0x400000000000'],
    ['0.5', '0x3FFE00000000'],
    ['1.5', '0x3FFF80000000'],
    ['-1', '0xBFFF00000000'],
  ])('%s -> %s', (value, hex) => {
    expect(toSicFloatHex(value)).toBe(hex);
  });

  it('shows what is not a number as zero', () => {
    expect(toSicFloatHex('abc')).toBe('0x000000000000');
    expect(toSicFloatHex('')).toBe('0x000000000000');
  });
});
