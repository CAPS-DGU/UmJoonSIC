import { describe, expect, it } from 'vitest';
import { moveItem } from '@/lib/moveItem';

describe('moveItem', () => {
  const items = ['a', 'b', 'c', 'd'];

  it('moves an item right and left', () => {
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('clamps the target to the ends', () => {
    expect(moveItem(items, 1, -1)).toEqual(['b', 'a', 'c', 'd']);
    expect(moveItem(items, 1, 9)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('leaves the list as it is for an unknown item, and does not change the input', () => {
    expect(moveItem(items, -1, 0)).toEqual(items);
    expect(moveItem(items, 2, 2)).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
});
