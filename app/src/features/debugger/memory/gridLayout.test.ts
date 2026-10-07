import { describe, expect, it } from 'vitest';
import { addressDigits, gridWidth, namePlacements } from '@/features/debugger/memory/gridLayout';

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

const label = (name: string, start: number, end = start, beginsHere = true) => ({
  name,
  start,
  end,
  beginsHere,
});

describe('where the names of a row go', () => {
  it('ends a name before the next range, and starts it under its first byte', () => {
    const [len] = namePlacements([label('LEN', 4, 6), label('ZERO', 7)]);
    expect(len.maxWidth).toContain('87.5%');
    expect(len.left).toContain('56.25%'); // (4 + 0.5) / 8
  });

  it('lets a name move left one letter into the previous bytes, and not onto the previous name', () => {
    const [, zero] = namePlacements([label('LEN', 4, 6), label('ZERO', 7)]);
    expect(zero.left).toMatch(
      /^max\(calc\(min\(.*\+ 3ch, 87\.5%\) \+ 1ch\), calc\(87\.5% - 1ch\), min\(/,
    );
    expect(zero.left).toContain('calc(100% - 4ch - 2px)');
  });

  it('shows no name for a range that began on an earlier row; a name may reach one letter into it', () => {
    const names = namePlacements([label('BUF', 0, 2, false), label('X1', 3)]);
    expect(names.map(n => n.label.name)).toEqual(['X1']);
    expect(names[0].left.startsWith('max(0px, calc(37.5% - 1ch),')).toBe(true);
  });
});
