import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<number, number>();
vi.mock('@/api/simulator', () => ({
  simulator: {
    memory: async (start: number, end: number) => ({
      values: Array.from({ length: end - start + 1 }, (_, i) => memory.get(start + i) ?? 0),
    }),
  },
}));

const { readRanges, useWatchStore, watchKey } = await import('./watchStore');

const v = (address: number, elementSize = 3, elementCount = 1) => ({
  name: `V${address}`,
  address,
  elementSize,
  elementCount,
  dataType: 'WORD',
});

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

describe('changed values', () => {
  beforeEach(() => {
    memory.clear();
    useWatchStore.getState().clearWatch();
    useWatchStore.getState().addWatch({ ...v(30), filePath: 'main.asm' });
    useWatchStore.getState().addWatch({ ...v(40, 1, 4), filePath: 'main.asm' });
  });

  it('marks the bytes that changed since the last read, when asked to', async () => {
    await useWatchStore.getState().fetchVarMemoryValue('step');
    // The first read has nothing to compare with.
    expect(useWatchStore.getState().changed.size).toBe(0);
    memory.set(32, 7);
    memory.set(42, 1);
    await useWatchStore.getState().fetchVarMemoryValue('step');
    const changed = useWatchStore.getState().changed;
    expect([
      ...(changed.get(watchKey({ filePath: 'main.asm', address: 30 }))?.keys() ?? []),
    ]).toEqual([2]);
    expect([
      ...(changed.get(watchKey({ filePath: 'main.asm', address: 40 }))?.keys() ?? []),
    ]).toEqual([2]);
  });

  it('keeps a value lit while auto-playing, and flashes it anew after a step', async () => {
    const key = watchKey({ filePath: 'main.asm', address: 30 });
    const markOf = () => useWatchStore.getState().changed.get(key)?.get(2);
    await useWatchStore.getState().fetchVarMemoryValue('step');
    memory.set(32, 1);
    await useWatchStore.getState().fetchVarMemoryValue('playing');
    const first = markOf();
    expect(first).toBeDefined();
    memory.set(32, 2);
    await useWatchStore.getState().fetchVarMemoryValue('playing');
    expect(markOf()).toBe(first);
    memory.set(32, 3);
    await useWatchStore.getState().fetchVarMemoryValue('step');
    expect(markOf()).toBeGreaterThan(first!);
    // Unchanged in the next step: no longer marked.
    await useWatchStore.getState().fetchVarMemoryValue('step');
    expect(markOf()).toBeUndefined();
  });

  it('does not mark during a fast run (no marks asked), but keeps the values', async () => {
    await useWatchStore.getState().fetchVarMemoryValue('step');
    memory.set(30, 9);
    await useWatchStore.getState().fetchVarMemoryValue('none');
    expect(useWatchStore.getState().changed.size).toBe(0);
    expect(useWatchStore.getState().watch[0].value).toEqual([9, 0, 0]);
  });
});
