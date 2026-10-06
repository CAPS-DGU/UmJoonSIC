import { describe, expect, it } from 'vitest';
import { readRanges } from './watchStore';

const v = (address: number, elementSize = 3, elementCount = 1) =>
  ({ name: `V${address}`, address, elementSize, elementCount, dataType: 'WORD' }) as never;

describe('watch read ranges', () => {
  it('reads neighbouring variables in one range', () => {
    expect(readRanges([v(30), v(33), v(36)])).toEqual([[30, 38]]);
  });
  it('keeps distant variables apart and sorts them', () => {
    expect(readRanges([v(1000), v(30), v(33, 1, 9)])).toEqual([
      [30, 41],
      [1000, 1002],
    ]);
  });
  it('skips empty areas', () => {
    expect(readRanges([v(30, 3, 0)])).toEqual([]);
  });
});
