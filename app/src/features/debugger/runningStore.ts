import { create } from 'zustand';
import path from 'path-browserify';
import { simulator } from '@/api/simulator';
import type { LoadedFile } from '@/api/types';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { useListingStore } from '@/features/listing/listingStore';
import { useErrorStore } from '@/features/panel/errorStore';
import { useWatchStore } from '@/features/panel/watchStore';
import { useProjectStore } from '@/features/project/projectStore';
import { toProjectRelativePath } from '@/lib/projectPath';
import { useModalStore } from '@/stores/modalStore';

const DEFAULT_DELAY_MS = 1000;

interface RunningState {
  /** A program is loaded in the simulator and the debugger toolbar is showing. */
  isRunning: boolean;
  /** Auto-play is not advancing. Starts true; cleared only by stopRunning(). */
  isPaused: boolean;
  /** Delay between instructions for the clock ("run with delay") button, in ms. */
  delayTime: number;
  setDelayTime: (delayTime: number) => void;
  setIsPaused: (isPaused: boolean) => void;
  toggleIsRunning: () => void;
  /** Save the open tabs, assemble the project and load it; on failure, publish the errors. */
  loadProgram: () => Promise<void>;
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
  const { addWatch, fetchVarMemoryValue } = useWatchStore.getState();
  const { addListing } = useListingStore.getState();
  const { openTab } = useEditorTabStore.getState();

  files.forEach(file => {
    openTab({
      title: `List: ${file.fileName.split('/').pop()!}`,
      filePath: path.join(file.fileName + '.lst'),
    });
    addListing(file.fileName, file.listing.rows);
    file.listing.watch.forEach(variable => addWatch({ filePath: file.fileName, ...variable }));
    fetchVarMemoryValue();
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
      useModalStore
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

export const useRunningStore = create<RunningState>((set, get) => ({
  isRunning: false,
  isPaused: true,
  delayTime: DEFAULT_DELAY_MS,

  setDelayTime: delayTime => set({ delayTime }),
  setIsPaused: isPaused => set({ isPaused }),
  toggleIsRunning: () => set(state => ({ isRunning: !state.isRunning })),

  loadProgram: async () => {
    const { projectPath, settings } = useProjectStore.getState();

    await beginSimulation();
    const { success } = await useEditorTabStore.getState().saveAllTabs();
    if (!success) {
      return;
    }

    const data = await simulator.load({
      filePaths: settings.asm.map(file => path.join(projectPath, file)),
      outputDir: path.join(projectPath, '.out'),
      main: settings.main == '' ? undefined : settings.main,
    });

    if (data.ok) {
      useErrorStore.getState().clearErrors(undefined, 'load');
      useRegisterStore.getState().setAll(data.registers);
      useMemoryViewStore.getState().setMemoryRange({
        start: data.registers.PC,
        end: data.registers.PC + 256,
      });
      publishLoadedFiles(data.files);
    } else {
      try {
        publishLoadErrors(data.files, projectPath);
        get().stopRunning();
      } catch (e) {
        console.error('Failed to parse load error response', e);
      }
    }
  },

  stopRunning: async () => {
    const data = await beginSimulation();
    if (!data.ok) {
      console.error('Failed to stop');
      return;
    }
    useListingStore.getState().clearListings();
    useEditorTabStore.getState().closeAllListFileTabs();
    useWatchStore.getState().clearWatch();
    set({ isPaused: false, isRunning: false });
  },
}));
