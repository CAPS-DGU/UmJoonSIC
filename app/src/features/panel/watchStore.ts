import { create } from 'zustand';
import { simulator } from '@/api/simulator';
import type { WatchVariable } from '@/api/types';
import { nextMarks, type ChangeMarks, type MarkMode } from '@/lib/changeMarks';

/** A watched variable of one source file, with its current bytes once fetched. */
export interface WatchRow extends WatchVariable {
  filePath: string;
  value?: number[];
}

/** The key of a watched variable (its file and address). */
export const watchKey = (row: Pick<WatchRow, 'filePath' | 'address'>) =>
  `${row.filePath}:${row.address}`;

interface WatchState {
  watch: WatchRow[];
  /** Byte offsets that changed in the last read, by watchKey; the panel flashes them. */
  changed: ReadonlyMap<string, ChangeMarks<number>>;
  /** Counts the reads (the numbers in `changed`). */
  changeVersion: number;
  addWatch: (watch: WatchRow) => void;
  clearWatch: () => void;
  clearChanged: () => void;
  /** Re-read the memory behind every watched variable and mark the bytes that changed. */
  fetchVarMemoryValue: (mode: MarkMode) => Promise<void>;
}

/** Variables closer than this (bytes) are read in one request. */
const MERGE_GAP = 64;

/** Address ranges [start, end] covering the variables, nearby ones merged. */
export function readRanges(variables: WatchVariable[]): [number, number][] {
  const spans = variables
    .map(v => [v.address, v.address + v.elementCount * v.elementSize - 1] as [number, number])
    .filter(([start, end]) => end >= start)
    .sort((a, b) => a[0] - b[0]);
  const ranges: [number, number][] = [];
  for (const [start, end] of spans) {
    const last = ranges.at(-1);
    if (last && start <= last[1] + MERGE_GAP) last[1] = Math.max(last[1], end);
    else ranges.push([start, end]);
  }
  return ranges;
}

/**
 * Read every watched variable's bytes: one request per group of nearby variables and one
 * store update (it was a request and an update per variable, 61 of each for PilotSIC, many
 * times a second during a fast run).
 */
async function readAll(
  set: (fn: (state: WatchState) => Partial<WatchState>) => void,
  mode: MarkMode,
) {
  const { watch } = useWatchStore.getState();
  if (watch.length === 0) return;
  const ranges = readRanges(watch);
  const read = await Promise.all(
    ranges.map(async ([start, end]) => {
      try {
        return { start, values: (await simulator.memory(start, end)).values };
      } catch (error) {
        console.error(`Failed to read memory ${start}-${end}:`, error);
        return null;
      }
    }),
  );
  const valueOf = (row: WatchRow) => {
    const end = row.address + row.elementCount * row.elementSize;
    const chunk = read.find(r => r && r.start <= row.address && r.start + r.values.length >= end);
    return chunk ? chunk.values.slice(row.address - chunk.start, end - chunk.start) : row.value;
  };
  set(state => {
    const update = state.changeVersion + 1;
    const changed = new Map<string, ChangeMarks<number>>();
    const watch = state.watch.map(row => {
      const value = valueOf(row);
      // A first value is not a change.
      if (row.value && value) {
        const bytes = value.flatMap((byte, i) => (row.value![i] !== byte ? [i] : []));
        const key = watchKey(row);
        const marks = nextMarks(state.changed.get(key) ?? new Map(), bytes, update, mode);
        if (marks.size > 0) changed.set(key, marks);
      }
      return { ...row, value };
    });
    return { watch, changed, changeVersion: update };
  });
}

/** The read in progress, and the one planned after it (requests while one runs share it). */
let running: Promise<void> | null = null;
let planned: Promise<void> | null = null;
/** How the planned read marks: the strongest way its requests asked for. */
let plannedMode: MarkMode = 'none';
const STRENGTH: Record<MarkMode, number> = { none: 0, playing: 1, step: 2 };
const stronger = (a: MarkMode, b: MarkMode) => (STRENGTH[a] >= STRENGTH[b] ? a : b);

export const useWatchStore = create<WatchState>(set => ({
  watch: [],
  changed: new Map(),
  changeVersion: 0,
  addWatch: watch => set(state => ({ watch: [...state.watch, watch] })),
  clearWatch: () => set({ watch: [], changed: new Map() }),
  clearChanged: () => set({ changed: new Map() }),
  fetchVarMemoryValue: (mode: MarkMode): Promise<void> => {
    // A read already planned will see the latest memory: share it.
    if (planned) {
      plannedMode = stronger(plannedMode, mode);
      return planned;
    }
    // One is running: plan one more after it, so that the values are never older than the
    // request (the final state after a halt or a pause must be exact).
    if (running) {
      plannedMode = mode;
      planned = running.then((): Promise<void> => {
        planned = null;
        const next = plannedMode;
        plannedMode = 'none';
        return useWatchStore.getState().fetchVarMemoryValue(next);
      });
      return planned;
    }
    running = readAll(set, mode).finally(() => {
      running = null;
    });
    return running;
  },
}));
