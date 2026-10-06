import { describe, expect, it } from 'vitest';
import { toChar, toDecimal, toHex } from './watchFormat';

describe('watch values', () => {
  it('shows a word as a signed 24-bit number', () => {
    expect(toDecimal([0x00, 0x00, 0x05])).toBe('5');
    expect(toDecimal([0xff, 0xff, 0xff])).toBe('-1');
    expect(toDecimal([0x80, 0x00, 0x00])).toBe('-8388608');
  });
  it('shows a byte as is and a longer area without a decimal value', () => {
    expect(toDecimal([200])).toBe('200');
    expect(toDecimal([0x48, 0x45, 0x4c, 0x4c, 0x4f])).toBe('');
  });
  it('shows hex and characters like a hex dump', () => {
    expect(toHex([0x48, 0x0a])).toBe('48 0A');
    expect(toChar([0x48, 0x0a])).toBe('H.');
  });
});
