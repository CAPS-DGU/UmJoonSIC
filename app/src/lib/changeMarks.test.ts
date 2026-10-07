import { describe, expect, it } from 'vitest';
import { nextMarks } from '@/lib/changeMarks';

describe('nextMarks', () => {
  const previous = new Map([
    ['a', 3],
    ['b', 3],
  ]);

  it('starts every flash anew after a step', () => {
    expect([...nextMarks(previous, ['a', 'c'], 4, 'step')]).toEqual([
      ['a', 4],
      ['c', 4],
    ]);
  });

  it('keeps the flash of a value already lit while auto-playing', () => {
    expect([...nextMarks(previous, ['a', 'c'], 4, 'playing')]).toEqual([
      ['a', 3],
      ['c', 4],
    ]);
  });

  it('marks nothing during a fast run', () => {
    expect(nextMarks(previous, ['a'], 4, 'none').size).toBe(0);
  });
});
