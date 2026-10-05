import { create } from 'zustand';
import path from 'path-browserify';
import { simulator } from '@/api/simulator';
import type { LoadedFile } from '@/api/types';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import {
  breakpointAt,
  listingsAt,
  listingTabPath,
  useListingStore,
} from '@/features/listing/listingStore';
import { useErrorStore } from '@/features/panel/errorStore';
import { useWatchStore } from '@/features/panel/watchStore';
import { useProjectStore } from '@/features/project/projectStore';
import { toProjectRelativePath } from '@/lib/projectPath';
import { useInfoModalStore } from '@/stores/infoModalStore';

const DEFAULT_DELAY_MS = 1000;
/** The longest delay a timer can wait (about 24 days); a longer one would run at once. */
const MAX_DELAY_MS = 2 ** 31 - 1;

/** The delay setting is kept for the next start of the app (it is the user's, not the project's). */
const DELAY_STORAGE_KEY = 'umjoonsic.delayTime';

function readSavedDelay() {
  try {
    const saved = parseFloat(localStorage.getItem(DELAY_STORAGE_KEY) ?? '');
    return Number.isFinite(saved) && saved >= 0 ? Math.min(saved, MAX_DELAY_MS) : DEFAULT_DELAY_MS;
  } catch {
    return DEFAULT_DELAY_MS;
  }
}

function saveDelay(delayMs: number) {
  try {
    localStorage.setItem(DELAY_STORAGE_KEY, String(delayMs));
  } catch (error) {
    console.warn('The delay setting could not be saved:', error);
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface RunningState {
  /** A program is loaded in the simulator and the debugger toolbar is showing. */
  isRunning: boolean;
  /** A program is being assembled and loaded (Run was clicked). */
  isStarting: boolean;
  /** Auto-play is not advancing (the program waits for Step or Continue). */
  isPaused: boolean;
  /** Delay between instructions while auto-playing, in ms; kept across app starts. */
  delayTime: number;
  setDelayTime: (delayTime: number) => void;
  /** Save the open tabs, assemble the project and load it. False if that failed. */
  loadProgram: () => Promise<boolean>;
  /** Load the program and stop at its first instruction. */
  run: () => Promise<void>;
  /** Load the program and auto-play it with the delay setting. */
  runWithDelay: () => Promise<void>;
  /** Auto-play from where the program stands (Continue). */
  resume: () => void;
  pause: () => void;
  /** Execute one instruction. */
  stepOnce: () => Promise<void>;
  /** Load the program again and stop at its first instruction. */
  restart: () => Promise<void>;
  /** Reset the simulator and close everything that belongs to the run. */
  stopRunning: () => Promise<void>;
  /** Open the List tabs that were closed during the run, and show the one the PC is in. */
  showListings: () => Promise<void>;
}

/** Restart the simulation in the current machine mode with the project's file devices. */
function beginSimulation() {
  const { mode } = useMemoryViewStore.getState();
  const { settings } = useProjectStore.getState();
  return simulator.begin(mode, settings.filedevices);
}

/** The tab that shows the listing of a loaded file (named as the simulator names it). */
const listingTab = (fileName: string) => ({
  title: `List: ${fileName.split('/').pop()!}`,
  filePath: listingTabPath(fileName),
});

/** Open a List tab for every loaded file and register its listing and watch variables. */
function publishLoadedFiles(files: LoadedFile[]) {
  const { addWatch } = useWatchStore.getState();
  const { addListing } = useListingStore.getState();
  const { openTab } = useEditorTabStore.getState();

  files.forEach(file => {
    openTab(listingTab(file.fileName));
    addListing(file.fileName, file.listing.rows);
    file.listing.watch.forEach(variable => addWatch({ filePath: file.fileName, ...variable }));
  });
}

/** Record the assembler errors, show a linker error if any, and open the first failing file. */
function publishLoadErrors(files: LoadedFile[], projectPath: string) {
  const { setErrors } = useErrorStore.getState();
  files.forEach(file => {
    if (file.assemblerErrors?.length) {
      setErrors(
        file.fileName,
        'load',
        file.assemblerErrors.map(err => ({
          row: err.row,
          col: err.col,
          length: err.length,
          message: err.message,
        })),
      );
    }
    if (file.linkerError) {
      useInfoModalStore
        .getState()
        .show('링커 에러', `[에러 발생 단계: ${file.linkerError.phase}]\n${file.linkerError.msg}`);
    }
  });

  const firstFailing = files.find(file => file.assemblerErrors?.length);
  if (firstFailing) {
    const firstError = firstFailing.assemblerErrors![0];
    const relativeFileName = toProjectRelativePath(projectPath, firstFailing.fileName);
    useEditorTabStore.getState().openTab({
      title: relativeFileName.split('/').pop()!,
      filePath: relativeFileName,
      cursor: { line: firstError.row, column: firstError.col },
    });
  }
}

/**
 * Read the memory the views show (the memory viewer and the watch list) again. With
 * `markChanges`, the memory viewer flashes the bytes that changed (after a step).
 */
function refreshMemoryViews({ markChanges }: { markChanges: boolean }) {
  const memory = useMemoryViewStore.getState();
  return Promise.all([
    markChanges ? memory.refresh() : memory.setViewRange(memory.viewRange),
    useWatchStore.getState().fetchVarMemoryValue(),
  ]);
}

/**
 * Identifies the current run. Starting or stopping a run changes it, so that work begun for
 * an earlier run (a step, a load, an auto-play loop) ends without touching the new one.
 */
let runId = 0;

/** Steps run one after another, also when Step is clicked faster than the simulator answers. */
let lastStep: Promise<unknown> = Promise.resolve();

/** A program being loaded; Run clicked again meanwhile waits for it instead of loading twice. */
let starting: Promise<boolean> | null = null;

export const useRunningStore = create<RunningState>((set, get) => {
  /**
   * Execute one instruction of the run `forRun` and refresh the views. When the program has
   * halted (the PC did not move), the run is stopped. Resolves to false if the run cannot go on.
   */
  const executeStep = (forRun: number): Promise<boolean> => {
    const step = lastStep.then(async () => {
      if (forRun !== runId || !get().isRunning) return false;
      const result = await useRegisterStore.getState().step();
      if (forRun !== runId) return false;
      if (result === 'failed') return false;
      if (result === 'halted') {
        await get().stopRunning();
        return false;
      }
      await refreshMemoryViews({ markChanges: true });
      return forRun === runId;
    });
    lastStep = step.catch(() => {});
    return step;
  };

  /**
   * Execute an instruction every `delayMs` until the user pauses or stops. The program pauses
   * when the PC reaches a row with a breakpoint, before that row is executed.
   */
  const autoPlay = async (delayMs: number) => {
    const forRun = ++runId;
    const isCurrent = () => forRun === runId && get().isRunning && !get().isPaused;
    set({ isPaused: false });
    try {
      // The delay is counted from the start of one step to the start of the next.
      let nextStepAt = Date.now() + delayMs;
      while (isCurrent()) {
        await sleep(Math.max(0, nextStepAt - Date.now()));
        if (!isCurrent()) return;
        nextStepAt = Date.now() + delayMs;
        const stepped = await executeStep(forRun);
        if (!isCurrent()) return;
        if (!stepped) {
          // The step failed (the run itself goes on): stop auto-playing.
          set({ isPaused: true });
          return;
        }
        if (breakpointAt(useListingStore.getState().listings, useRegisterStore.getState().PC)) {
          set({ isPaused: true });
          return;
        }
      }
    } catch (error) {
      console.error('Auto-play stopped:', error);
      if (forRun === runId) set({ isPaused: true });
    }
  };

  /** Load the program and show it, stopped at its first instruction. False if that failed. */
  const start = () => {
    starting ??= (async () => {
      set({ isStarting: true });
      try {
        const forRun = ++runId;
        if (!(await get().loadProgram())) return false;
        if (forRun !== runId) return false;
        set({ isRunning: true, isPaused: true });
        await refreshMemoryViews({ markChanges: false });
        return true;
      } finally {
        starting = null;
        set({ isStarting: false });
      }
    })();
    return starting;
  };

  return {
    isRunning: false,
    isStarting: false,
    isPaused: true,
    delayTime: readSavedDelay(),

    setDelayTime: delayMs => {
      const delayTime = Math.min(delayMs, MAX_DELAY_MS);
      set({ delayTime });
      saveDelay(delayTime);
    },

    loadProgram: async () => {
      const forRun = runId;
      const { projectPath, settings } = useProjectStore.getState();

      const begun = await beginSimulation();
      if (!begun.ok) {
        // For example a file device that cannot be opened (project.sic edited by hand).
        useInfoModalStore
          .getState()
          .show('시뮬레이터 오류', begun.message ?? '시뮬레이션을 시작하지 못했습니다.');
        return false;
      }
      // The memory of an earlier run is gone from the simulator; stop showing it.
      await useMemoryViewStore.getState().reload();
      const { success } = await useEditorTabStore.getState().saveAllTabs();
      if (!success) return false;

      const data = await simulator.load({
        filePaths: settings.asm.map(file => path.join(projectPath, file)),
        outputDir: path.join(projectPath, '.out'),
        main: settings.main == '' ? undefined : settings.main,
      });
      // The run was stopped, or the project changed, while the program was assembled.
      if (forRun !== runId) return false;

      // This load's errors replace those of the last one.
      useErrorStore.getState().clearErrors(undefined, 'load');
      if (!data.ok) {
        publishLoadErrors(data.files, projectPath);
        await get().stopRunning();
        return false;
      }
      useRegisterStore.getState().setAll(data.registers);
      publishLoadedFiles(data.files);
      return true;
    },

    run: async () => {
      await start();
    },

    runWithDelay: async () => {
      if (await start()) {
        void autoPlay(get().delayTime);
      }
    },

    resume: () => {
      if (get().isRunning) {
        void autoPlay(get().delayTime);
      }
    },

    pause: () => {
      runId++;
      set({ isPaused: true });
    },

    stepOnce: async () => {
      if (get().isRunning && get().isPaused) {
        await executeStep(runId);
      }
    },

    restart: async () => {
      await get().stopRunning();
      await start();
    },

    stopRunning: async () => {
      runId++;
      // Whatever the simulator answers, the run is over for the user.
      useListingStore.getState().clearListings();
      useEditorTabStore.getState().closeListingTabs();
      useWatchStore.getState().clearWatch();
      set({ isPaused: true, isRunning: false });
      try {
        const data = await beginSimulation();
        if (!data.ok) console.error('Failed to reset the simulation:', data.message);
      } catch (error) {
        console.error('Failed to reset the simulation:', error);
      }
    },

    showListings: async () => {
      if (!get().isRunning) return;
      const { listings } = useListingStore.getState();
      const { openTab } = useEditorTabStore.getState();
      for (const listing of listings) {
        await openTab(listingTab(listing.filePath));
      }
      const current = listingsAt(listings, useRegisterStore.getState().PC)[0] ?? listings[0];
      if (current) await openTab(listingTab(current.filePath));
    },
  };
});
