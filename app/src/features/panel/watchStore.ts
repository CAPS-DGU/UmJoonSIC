import { create } from 'zustand';
import { simulator } from '@/api/simulator';
import type { WatchVariable } from '@/api/types';

/** A watched variable of one source file, with its current bytes once fetched. */
export interface WatchRow extends WatchVariable {
  filePath: string;
  value?: number[];
}

interface WatchState {
  watch: WatchRow[];
  addWatch: (watch: WatchRow) => void;
  clearWatch: () => void;
  /** Re-read the memory behind every watched variable. */
  fetchVarMemoryValue: () => Promise<void>;
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
async function readAll(set: (fn: (state: WatchState) => Partial<WatchState>) => void) {
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
  set(state => ({ watch: state.watch.map(row => ({ ...row, value: valueOf(row) })) }));
}

/** The read in progress, and the one planned after it (requests while one runs share it). */
let running: Promise<void> | null = null;
let planned: Promise<void> | null = null;

export const useWatchStore = create<WatchState>(set => ({
  watch: [],
  addWatch: watch => set(state => ({ watch: [...state.watch, watch] })),
  clearWatch: () => set({ watch: [] }),
  fetchVarMemoryValue: (): Promise<void> => {
    // A read already planned will see the latest memory: share it.
    if (planned) return planned;
    // One is running: plan one more after it, so that the values are never older than the
    // request (the final state after a halt or a pause must be exact).
    if (running) {
      planned = running.then((): Promise<void> => {
        planned = null;
        return useWatchStore.getState().fetchVarMemoryValue();
      });
      return planned;
    }
    running = readAll(set).finally(() => {
      running = null;
    });
    return running;
  },
}));
