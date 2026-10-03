import { create } from 'zustand';
import path from 'path-browserify';
import { simulator } from '@/api/simulator';
import type { LoadedFile } from '@/api/types';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { breakpointAt, listingTabPath, useListingStore } from '@/features/listing/listingStore';
import { useErrorStore } from '@/features/panel/errorStore';
import { useWatchStore } from '@/features/panel/watchStore';
import { useProjectStore } from '@/features/project/projectStore';
import { toProjectRelativePath } from '@/lib/projectPath';
import { useInfoModalStore } from '@/stores/infoModalStore';

const DEFAULT_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface RunningState {
  /** A program is loaded in the simulator and the debugger toolbar is showing. */
  isRunning: boolean;
  /** Auto-play is not advancing (the program waits for Step or Continue). */
  isPaused: boolean;
  /** Delay between instructions while auto-playing, in ms. */
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
}

/** Restart the simulation in the current machine mode with the project's file devices. */
function beginSimulation() {
  const { mode } = useMemoryViewStore.getState();
  const { settings } = useProjectStore.getState();
  return simulator.begin(mode, settings.filedevices);
}

/** Open a List tab for every loaded file and register its listing and watch variables. */
function publishLoadedFiles(files: LoadedFile[]) {
  const { addWatch } = useWatchStore.getState();
  const { addListing } = useListingStore.getState();
  const { openTab } = useEditorTabStore.getState();

  files.forEach(file => {
    openTab({
      title: `List: ${file.fileName.split('/').pop()!}`,
      filePath: listingTabPath(file.fileName),
    });
    addListing(file.fileName, file.listing.rows);
    file.listing.watch.forEach(variable => addWatch({ filePath: file.fileName, ...variable }));
  });
}

/** Record the assembler errors, show a linker error if any, and open the first failing file. */
function publishLoadErrors(files: LoadedFile[], projectPath: string) {
  const { addErrors } = useErrorStore.getState();
  files.forEach(file => {
    if (file.assemblerErrors?.length) {
      addErrors(
        file.fileName,
        file.assemblerErrors.map(err => ({
          row: err.row,
          col: err.col,
          length: err.length,
          message: err.message,
          type: 'load',
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

/** Read the memory the views show (the memory viewer and the watch list) again. */
function refreshMemoryViews() {
  return Promise.all([
    useMemoryViewStore.getState().refresh(),
    useWatchStore.getState().fetchVarMemoryValue(),
  ]);
}

/**
 * Auto-play runs as a loop; starting, pausing or stopping it makes the current loop
 * outdated, and it ends at its next check.
 */
let playGeneration = 0;

/** Steps run one after another, also when Step is clicked faster than the simulator answers. */
let lastStep: Promise<unknown> = Promise.resolve();

export const useRunningStore = create<RunningState>((set, get) => {
  /**
   * Execute one instruction and refresh the views. When the program has halted (the PC
   * did not move), the run is stopped. Resolves to false if the run cannot go on.
   */
  const executeStep = (): Promise<boolean> => {
    const step = lastStep.then(async () => {
      if (!get().isRunning) return false;
      const result = await useRegisterStore.getState().step();
      if (result === 'failed') return false;
      if (result === 'halted') {
        await get().stopRunning();
        return false;
      }
      await refreshMemoryViews();
      return true;
    });
    lastStep = step.catch(() => {});
    return step;
  };

  /**
   * Execute an instruction every `delayMs` until the user pauses or stops. The program pauses
   * when the PC reaches a row with a breakpoint, before that row is executed.
   */
  const autoPlay = async (delayMs: number) => {
    const generation = ++playGeneration;
    const isCurrent = () => generation === playGeneration && get().isRunning && !get().isPaused;
    set({ isPaused: false });
    try {
      // The delay is counted from the start of one step to the start of the next.
      let nextStepAt = Date.now() + delayMs;
      while (isCurrent()) {
        await sleep(Math.max(0, nextStepAt - Date.now()));
        if (!isCurrent()) return;
        nextStepAt = Date.now() + delayMs;
        if (!(await executeStep()) || !isCurrent()) return;
        if (breakpointAt(useListingStore.getState().listings, useRegisterStore.getState().PC)) {
          set({ isPaused: true });
          return;
        }
      }
    } catch (error) {
      console.error('Auto-play stopped:', error);
      set({ isPaused: true });
    }
  };

  /** Load the program and show it, stopped at its first instruction. */
  const start = async () => {
    playGeneration++;
    if (!(await get().loadProgram())) return false;
    set({ isRunning: true, isPaused: true });
    await refreshMemoryViews();
    return true;
  };

  return {
    isRunning: false,
    isPaused: true,
    delayTime: DEFAULT_DELAY_MS,

    setDelayTime: delayTime => set({ delayTime }),

    loadProgram: async () => {
      const { projectPath, settings } = useProjectStore.getState();

      await beginSimulation();
      // The memory of an earlier run is gone from the simulator; stop showing it.
      await useMemoryViewStore.getState().reload();
      const { success } = await useEditorTabStore.getState().saveAllTabs();
      if (!success) return false;

      const data = await simulator.load({
        filePaths: settings.asm.map(file => path.join(projectPath, file)),
        outputDir: path.join(projectPath, '.out'),
        main: settings.main == '' ? undefined : settings.main,
      });

      if (!data.ok) {
        publishLoadErrors(data.files, projectPath);
        await get().stopRunning();
        return false;
      }
      useErrorStore.getState().clearErrors(undefined, 'load');
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
      playGeneration++;
      set({ isPaused: true });
    },

    stepOnce: async () => {
      if (get().isRunning && get().isPaused) {
        await executeStep();
      }
    },

    restart: async () => {
      await get().stopRunning();
      await start();
    },

    stopRunning: async () => {
      playGeneration++;
      const data = await beginSimulation();
      if (!data.ok) {
        console.error('Failed to stop');
        return;
      }
      useListingStore.getState().clearListings();
      useEditorTabStore.getState().closeListingTabs();
      useWatchStore.getState().clearWatch();
      set({ isPaused: true, isRunning: false });
    },
  };
});
