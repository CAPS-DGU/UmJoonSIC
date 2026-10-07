import { create } from 'zustand';
import { simulator } from '@/api/simulator';
import type { MachineMode } from '@/api/types';
import { recheckOpenProjectFiles } from '@/features/editor/lib/syntaxCheck';
import { nextMarks, type ChangeMarks, type MarkMode } from '@/lib/changeMarks';
import { resolveInProject } from '@/lib/projectPath';
import { useProjectStore } from '@/features/project/projectStore';

export type { MachineMode };

/** A range of addresses; `end` is exclusive. */
export interface AddressRange {
  start: number;
  end: number;
}

/** Address space per machine mode: SIC has 32 KiB, SIC/XE has 1 MiB. */
const MEMORY_SIZE: Record<MachineMode, number> = { SIC: 0x8000, SICXE: 0x100000 };

/** Where the viewer starts: the first 1 KiB. */
const INITIAL_VIEW: AddressRange = { start: 0, end: 1024 };

interface MemoryViewState {
  mode: MachineMode;
  totalMemorySize: number;
  /** Byte values by address, as last read. Addresses never read are absent. */
  bytes: ReadonlyMap<number, number>;
  /** Addresses whose last read failed. */
  failed: ReadonlySet<number>;
  /** Reads in progress; bytes not known yet are shown as loading meanwhile. */
  pendingReads: number;
  /** What the viewer shows (with a margin around it). Read again after every step. */
  viewRange: AddressRange;
  /** Addresses whose value changed in the last refresh; the viewer flashes them. */
  changedNodes: ChangeMarks<number>;
  /** Counts the refreshes (the numbers in changedNodes). */
  changeVersion: number;
  /** A request to show an address (a variable, the last write): the viewer scrolls to it. */
  revealRequest: { address: number; size: number; id: number } | null;
  /** Show `size` bytes at `address`: scrolled to if not on screen, then highlighted. */
  reveal: (address: number, size?: number) => void;

  /** Switch machine mode: clears the view and restarts the simulation in that mode. */
  setMode: (mode: MachineMode) => void;
  /**
   * Show another range and read it. With `keepKnown`, bytes already shown keep their
   * value (after a run has ended, the view keeps the memory as the run left it).
   */
  setViewRange: (range: AddressRange, options?: { keepKnown?: boolean }) => Promise<void>;
  /** Read the shown range again (after a step) and mark the bytes that changed (see MarkMode). */
  refresh: (mode: MarkMode) => Promise<void>;
  /** Forget what is shown and read it again (the simulator's memory was reset). */
  reload: () => Promise<void>;
  clearChangedNodes: () => void;
}

const clamp = (range: AddressRange, size: number): AddressRange => ({
  start: Math.max(0, Math.min(range.start, size)),
  end: Math.max(0, Math.min(range.end, size)),
});

export const useMemoryViewStore = create<MemoryViewState>((set, get) => {
  /** Read a range from the simulator; null if that failed (its bytes are then marked). */
  const read = async ({ start, end }: AddressRange) => {
    if (end <= start) return null;
    set(state => ({ pendingReads: state.pendingReads + 1 }));
    try {
      // The simulator's range is inclusive.
      const { values } = await simulator.memory(start, end - 1);
      return values;
    } catch (error) {
      console.error(`Memory ${start}-${end} could not be loaded:`, error);
      set(state => {
        const failed = new Set(state.failed);
        for (let address = start; address < end; address++) failed.add(address);
        return { failed };
      });
      return null;
    } finally {
      set(state => ({ pendingReads: state.pendingReads - 1 }));
    }
  };

  /** Store bytes read from `start`; returns the addresses whose known value changed. */
  const store = (start: number, values: number[], keepKnown: boolean) => {
    const changed = new Set<number>();
    set(state => {
      const bytes = new Map(state.bytes);
      const failed = new Set(state.failed);
      values.forEach((value, i) => {
        const address = start + i;
        const known = bytes.get(address);
        failed.delete(address);
        if (known !== undefined && keepKnown) return;
        if (known !== undefined && known !== value) changed.add(address);
        bytes.set(address, value);
      });
      return { bytes, failed };
    });
    return changed;
  };

  return {
    mode: 'SIC',
    totalMemorySize: MEMORY_SIZE.SIC,
    bytes: new Map(),
    failed: new Set(),
    pendingReads: 0,
    viewRange: INITIAL_VIEW,
    changedNodes: new Map(),
    changeVersion: 0,
    revealRequest: null,
    reveal: (address, size = 1) =>
      set(state => ({ revealRequest: { address, size, id: (state.revealRequest?.id ?? 0) + 1 } })),

    setMode: mode => {
      const totalMemorySize = MEMORY_SIZE[mode];
      set(state => ({
        mode,
        totalMemorySize,
        bytes: new Map(),
        failed: new Set(),
        changedNodes: new Map(),
        viewRange: clamp(state.viewRange, totalMemorySize),
      }));

      // Restart the simulation in the new mode, then read the view and check the open files
      // again: what is valid depends on the mode, and the simulator works in the mode it is in.
      void (async () => {
        try {
          const { settings, projectPath } = useProjectStore.getState();
          // Relative device paths are inside the project (the simulator would open them in
          // its own working folder).
          const data = await simulator.begin(
            mode,
            settings.filedevices.map(d => ({
              ...d,
              filename: resolveInProject(projectPath, d.filename),
            })),
          );
          if (!data.ok) {
            console.error('Failed to begin after mode change');
          }
        } catch (e) {
          console.error('Begin request failed after mode change:', e);
        }
        await get().setViewRange(get().viewRange);
        recheckOpenProjectFiles();
      })();
    },

    setViewRange: async (range, { keepKnown = false } = {}) => {
      const viewRange = clamp(range, get().totalMemorySize);
      set({ viewRange });
      const values = await read(viewRange);
      if (values) store(viewRange.start, values, keepKnown);
    },

    refresh: async mode => {
      const { viewRange } = get();
      const values = await read(viewRange);
      if (values) {
        const changed = store(viewRange.start, values, false);
        set(state => ({
          changedNodes: nextMarks(state.changedNodes, changed, state.changeVersion + 1, mode),
          changeVersion: state.changeVersion + 1,
        }));
      }
    },

    reload: async () => {
      set({ bytes: new Map(), failed: new Set(), changedNodes: new Map() });
      await get().setViewRange(get().viewRange);
    },

    clearChangedNodes: () => set({ changedNodes: new Map() }),
  };
});
