import { create } from 'zustand';
import path from 'path-browserify';
import { simulator } from '@/api/simulator';
import type { LoadedFile, Registers } from '@/api/types';
import { deviceHex, deviceInstructions } from '@/features/debugger/lib/deviceUse';
import { devicesInSources } from '@/features/devices/sourceDevices';
import {
  flushDeviceStreams,
  recordDeviceStep,
  startDeviceStreams,
  stopDeviceRecording,
} from '@/features/devices/deviceStreamStore';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import {
  breakpointAt,
  listingsAt,
  listingTabPath,
  useListingStore,
} from '@/features/listing/listingStore';
import { useConsoleStore } from '@/features/panel/consoleStore';
import { useErrorStore } from '@/features/panel/errorStore';
import { usePanelStore } from '@/features/panel/panelStore';
import { useWatchStore } from '@/features/panel/watchStore';
import { usableDevicePaths } from '@/features/project/devicePaths';
import { connectToNewFile, suggestedFileName } from '@/features/project/deviceSettings';
import { openProjectSettings } from '@/features/project/projectSettingsTab';
import { useProjectStore } from '@/features/project/projectStore';
import { strings } from '@/i18n';
import type { MarkMode } from '@/lib/changeMarks';
import { resolveInProject, toProjectRelativePath } from '@/lib/projectPath';
import { ask, showError } from '@/stores/dialogStore';
import { notify } from '@/stores/toastStore';

/** 250 ms: four instructions a second, easy to follow step by step; Fastest is one click away. */
export const DEFAULT_INTERVAL_MS = 250;
/** The longest delay a timer can wait (about 24 days); a longer one would run at once. */
const MAX_DELAY_MS = 2 ** 31 - 1;
/**
 * Below this interval the run is "fast": the screen is not redrawn after every instruction
 * (registers at most every FAST_REGISTERS_MS, memory and variables every FAST_VIEWS_MS), so
 * that the simulator, not the drawing, sets the speed. The program is still checked after
 * every instruction for a breakpoint or its end.
 */
const FAST_BELOW_MS = 20;
const FAST_REGISTERS_MS = 50;
const FAST_VIEWS_MS = 250;
/** How often the instructions-per-second figure of the status bar is updated. */
const RATE_WINDOW_MS = 500;

/** The interval is kept for the next start of the app (it is the user's, not the project's). */
const INTERVAL_STORAGE_KEY = 'umjoonsic.runInterval';

function readSavedInterval() {
  try {
    const saved = parseFloat(localStorage.getItem(INTERVAL_STORAGE_KEY) ?? '');
    return Number.isFinite(saved) && saved >= 0
      ? Math.min(saved, MAX_DELAY_MS)
      : DEFAULT_INTERVAL_MS;
  } catch {
    return DEFAULT_INTERVAL_MS;
  }
}

function saveInterval(ms: number) {
  try {
    localStorage.setItem(INTERVAL_STORAGE_KEY, String(ms));
  } catch (error) {
    console.warn('The interval could not be saved:', error);
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export const formatAddress = (pc: number) => `0x${pc.toString(16).toUpperCase().padStart(6, '0')}`;

/** Why the program is not advancing (shown in the status bar). */
export type StopReason = 'start' | 'pause' | 'step' | 'breakpoint' | 'halt';

interface RunningState {
  /** A program is loaded in the simulator (also after it halted, until Stop). */
  isRunning: boolean;
  /** A program is being assembled and loaded. */
  isStarting: boolean;
  /** Auto-play is not advancing (the program waits for Step or Continue, or it halted). */
  isPaused: boolean;
  /** The program ended (it jumps to itself). Its final state stays on screen until Stop. */
  isHalted: boolean;
  stopReason: StopReason;
  /** Instructions executed since the program was loaded. */
  stepCount: number;
  /** Instructions per second while auto-playing (0 otherwise). */
  rate: number;
  /** The last Run or Step did not start: the program has errors (shown while they remain). */
  loadFailed: boolean;
  /** Time between instructions while auto-playing, in ms; changes apply at once. */
  delayTime: number;
  setDelayTime: (delayTime: number) => void;
  /** Save the open tabs, check the project, assemble and load it. False if that failed. */
  loadProgram: () => Promise<boolean>;
  /** Load the program and stop at its first instruction. */
  run: () => Promise<void>;
  /** Load the program and run it at the interval. */
  runWithDelay: () => Promise<void>;
  /** F5: run (nothing loaded, or halted), or continue (paused). */
  startOrContinue: () => Promise<void>;
  /** F10: one instruction (paused), or load and stop at the first one (nothing loaded). */
  stepOrStart: () => Promise<void>;
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

/**
 * Devices the user chose to run without (their file cannot be used on this computer); the
 * simulator gets them as unconnected, so it creates no file named like their path.
 */
let skippedDevices = new Set<number>();

/** Device files may be relative to the project (portable between computers) or absolute. */
function absoluteDevices() {
  const { settings, projectPath } = useProjectStore.getState();
  return settings.filedevices
    .filter(device => !skippedDevices.has(device.index))
    .map(device => ({
      ...device,
      filename: resolveInProject(projectPath, device.filename),
    }));
}

/**
 * Empty the files of the devices the program only writes (WD, never RD): the simulator writes
 * from the start of a file without cutting it, so a shorter output left the end of the last
 * run's ("AB" over "XXXXXX" gave "ABXXXX").
 */
async function emptyOutputFiles() {
  const { projectPath, settings } = useProjectStore.getState();
  const texts = await Promise.all(
    settings.asm.map(async file => {
      const res = await window.api.readFile(resolveInProject(projectPath, file));
      return res.success && typeof res.data === 'string' ? res.data : '';
    }),
  );
  const outputOnly = devicesInSources(texts).filter(
    d => d.uses.includes('write') && !d.uses.includes('read'),
  );
  const files = absoluteDevices().filter(d => outputOnly.some(o => o.device === d.index));
  await Promise.all(files.map(d => window.api.saveFile(d.filename, '')));
}

/** Restart the simulation in the current machine mode with the project's file devices. */
function beginSimulation() {
  const { mode } = useMemoryViewStore.getState();
  return simulator.begin(mode, absoluteDevices());
}

/** The tab that shows the listing of a loaded file (named as the simulator names it). */
const listingTab = (fileName: string) => ({
  title: strings().tabs.listing(fileName.split('/').pop()!),
  filePath: listingTabPath(fileName),
});

/** Open the project settings tab (from a message's button). */
const openSettings = openProjectSettings;

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
  const t = strings();
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
      void showError(
        t.messages.linkerError,
        file.linkerError.msg,
        t.messages.linkerPhase(file.linkerError.phase),
      );
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
 * Before assembling: files the project lists must exist (otherwise the simulator reports a
 * raw "ENOENT"), and device files should (a path from another computer makes the simulator
 * create a stray file). False if the user should fix the project first.
 */
async function checkProjectFiles(): Promise<boolean> {
  const t = strings();
  const { settings, projectPath } = useProjectStore.getState();

  if (settings.asm.length === 0) {
    const choice = await ask<'close' | 'settings'>({
      title: t.messages.missingAsmTitle,
      message: t.messages.noAsm,
      tone: 'error',
      buttons: [
        { label: t.common.close, value: 'close', variant: 'plain' },
        { label: t.messages.openSettings, value: 'settings', variant: 'primary' },
      ],
      cancelValue: 'close',
    });
    if (choice === 'settings') void openSettings();
    return false;
  }

  const asmExists = await window.api.pathExists(
    settings.asm.map(file => path.join(projectPath, file)),
  );
  const missing = settings.asm.filter(
    (_, i) => asmExists.success && asmExists.data && !asmExists.data[i],
  );
  if (missing.length > 0) {
    const choice = await ask<'close' | 'settings'>({
      title: t.messages.missingAsmTitle,
      message: t.messages.missingAsm(missing.join(', ')),
      tone: 'error',
      buttons: [
        { label: t.common.close, value: 'close', variant: 'plain' },
        { label: t.messages.openSettings, value: 'settings', variant: 'primary' },
      ],
      cancelValue: 'close',
    });
    if (choice === 'settings') void openSettings();
    return false;
  }

  skippedDevices = new Set();
  const devices = absoluteDevices().filter(d => d.filename);
  const usable = await usableDevicePaths(
    projectPath,
    devices.map(d => d.filename),
  );
  const unusable = devices.filter((_, i) => !usable[i]);
  if (unusable.length > 0) {
    const first = unusable[0];
    const choice = await ask<'cancel' | 'settings' | 'run'>({
      title: t.messages.deviceTitle,
      message: t.messages.deviceFileMissing(deviceHex(first.index), first.filename),
      tone: 'warning',
      buttons: [
        { label: t.common.cancel, value: 'cancel', variant: 'plain' },
        { label: t.messages.runWithoutDevice, value: 'run', variant: 'plain' },
        { label: t.messages.openSettings, value: 'settings', variant: 'primary' },
      ],
      cancelValue: 'cancel',
    });
    if (choice === 'settings') void openSettings();
    if (choice !== 'run') return false;
    skippedDevices = new Set(unusable.map(d => d.index));
  }
  return true;
}

/**
 * After loading: devices the program uses but the project does not connect. The notice's
 * action connects each to a new file named after its symbol (INDEV → indev.txt) and runs
 * the program again with them: the fix is offered where the need appears.
 */
function warnUnconnectedDevices(files: LoadedFile[]) {
  const connected = new Set(useProjectStore.getState().settings.filedevices.map(d => d.index));
  const byDevice = new Map<number, string[]>();
  for (const { device, label } of deviceInstructions(files.map(f => f.listing.rows))) {
    if (connected.has(device)) continue;
    const labels = byDevice.get(device) ?? [];
    if (label && !labels.includes(label)) labels.push(label);
    byDevice.set(device, labels);
  }
  if (byDevice.size === 0) return;
  const t = strings();
  const names = [...byDevice].map(([device, labels]) => ({
    device,
    name: suggestedFileName(device, labels),
  }));
  notify('warning', t.messages.unmappedDevice([...byDevice.keys()].map(deviceHex).join(', ')), {
    label: t.messages.connectAndRestart(names.map(n => n.name).join(', ')),
    run: () =>
      void (async () => {
        for (const { device, name } of names) {
          if (!(await connectToNewFile(device, name))) return;
        }
        await useRunningStore.getState().restart();
      })(),
  });
}

/**
 * Read the memory the views show (the memory viewer and the watch list) again; both mark the
 * bytes that changed as `mode` says (lib/changeMarks: a step flashes them, a fast run does not
 * mark, or everything would flash all the time).
 */
function refreshMemoryViews(mode: MarkMode) {
  return Promise.all([
    useMemoryViewStore.getState().refresh(mode),
    useWatchStore.getState().fetchVarMemoryValue(mode),
  ]);
}

/**
 * Identifies the current auto-play loop or step sequence. Pause, Continue, Stop and a new run
 * change it, so that a loop begun earlier ends without driving the new one.
 */
let runId = 0;

/**
 * Identifies the loaded program. Only loading and Stop change it: a step that answers after
 * one of those belongs to a program that is gone, and its result is dropped. (A step that
 * answers after Pause still belongs to the program on screen, and is shown.)
 */
let loadId = 0;

/**
 * The simulator's PC after the last instruction it executed (or after loading), which the
 * screen may not show yet in fast mode. The program has halted when an instruction leaves
 * the PC where it was (it jumps to itself).
 */
let simulatorPC = 0;
/** The registers after that instruction: what a WD wrote is A's low byte before the next. */
let simulatorRegisters: Registers | null = null;

/**
 * Every instruction goes through this queue, in auto-play and from Step alike, so that the
 * simulator never gets two at once (Step clicked faster than it answers, or Step right after
 * Pause while a fast-mode instruction is still on its way).
 */
let lastStep: Promise<unknown> = Promise.resolve();

function enqueueStep<T>(work: () => Promise<T>): Promise<T> {
  const step = lastStep.then(work);
  lastStep = step.catch(() => {});
  return step;
}

type StepResult = { ok: true; registers: Registers; halted: boolean } | { ok: false };

/** Execute one instruction in the simulator. Only call it from a queued step (enqueueStep). */
async function simulatorStep(): Promise<StepResult> {
  const pcBefore = simulatorPC;
  const before = simulatorRegisters;
  const data = await simulator.step();
  if (!data.ok) return { ok: false };
  const halted = data.registers.PC === simulatorPC;
  simulatorPC = data.registers.PC;
  simulatorRegisters = data.registers;
  // What an RD/WD/TD read or wrote (the Devices panel).
  if (before && !halted) recordDeviceStep(pcBefore, before, data.registers);
  return { ok: true, registers: data.registers, halted };
}

/** A program being loaded; Run clicked again meanwhile waits for it instead of loading twice. */
let starting: Promise<boolean> | null = null;

export const useRunningStore = create<RunningState>((set, get) => {
  /** The program ended: keep everything on screen and say so (status bar, listing). */
  const enterHalted = async () => {
    runId++;
    flushDeviceStreams('step');
    set({ isPaused: true, isHalted: true, stopReason: 'halt', rate: 0 });
    useConsoleStore
      .getState()
      .addRunLine(
        strings().state.logHalted(formatAddress(useRegisterStore.getState().PC), get().stepCount),
      );
    await refreshMemoryViews('step');
  };

  /**
   * Execute one instruction of the run `forRun` and refresh the views, marking what changed as
   * `mode` says (a step, or an instruction of a slow auto-play). Resolves to false if the run
   * cannot go on (it halted, failed or was stopped).
   */
  const executeStep = (forRun: number, mode: 'step' | 'playing'): Promise<boolean> =>
    enqueueStep(async () => {
      if (forRun !== runId || !get().isRunning || get().isHalted) return false;
      const forLoad = loadId;
      const result = await simulatorStep();
      if (forLoad !== loadId || !result.ok) return false;
      // Shown even if the user paused meanwhile: it is where the program now stands.
      useRegisterStore.getState().setAll(result.registers);
      set(state => ({ stepCount: state.stepCount + 1 }));
      if (result.halted) {
        await enterHalted();
        return false;
      }
      flushDeviceStreams(mode);
      await refreshMemoryViews(mode);
      return forRun === runId;
    });

  /**
   * Auto-play: an instruction every interval until the user pauses or stops, the program
   * reaches a breakpoint (before that row runs) or halts. The interval is read before every
   * instruction, so a change applies at once; below FAST_BELOW_MS the screen is redrawn
   * only now and then (see there).
   */
  const autoPlay = async () => {
    const forRun = ++runId;
    const forLoad = loadId;
    const isCurrent = () =>
      forRun === runId && get().isRunning && !get().isPaused && !get().isHalted;
    set({ isPaused: false, stopReason: 'start' });

    let registers: Registers = useRegisterStore.getState();
    let lastStepAt = Date.now();
    let lastRegistersAt = 0;
    let lastViewsAt = Date.now();
    let rateSince = Date.now();
    let rateSteps = 0;
    let unpublished = 0;
    /** Fast instructions ran since the views were last marked. */
    let unmarked = false;

    /** Show what fast mode has not shown yet. */
    const publish = async () => {
      if (unpublished > 0) {
        useRegisterStore.getState().setAll(registers);
        set(state => ({ stepCount: state.stepCount + unpublished }));
        unpublished = 0;
      }
    };
    const stopAt = async (reason: StopReason) => {
      await publish();
      set({ isPaused: true, stopReason: reason, rate: 0 });
      // After a slow instruction the views are marked already (marking them again would find
      // nothing changed and clear its marks).
      if (unmarked) {
        flushDeviceStreams('step');
        await refreshMemoryViews('step');
      }
    };

    try {
      while (isCurrent()) {
        const interval = get().delayTime;
        if (interval >= FAST_BELOW_MS) {
          // Slow: every instruction is shown as it happens.
          await publish();
          // Wait out the interval, read again as it passes: a shorter one chosen meanwhile
          // applies at once, not after the longer wait already begun.
          while (isCurrent() && Date.now() < lastStepAt + get().delayTime) {
            await sleep(Math.min(50, lastStepAt + get().delayTime - Date.now()));
          }
          if (!isCurrent()) return;
          lastStepAt = Date.now();
          const stepped = await executeStep(forRun, 'playing');
          unmarked = false;
          if (!isCurrent()) return;
          if (!stepped) {
            // The step failed (the run itself goes on): stop auto-playing.
            if (!get().isHalted) set({ isPaused: true, stopReason: 'pause', rate: 0 });
            return;
          }
          registers = useRegisterStore.getState();
        } else {
          // Fast: the screen catches up now and then.
          if (interval > 0) await sleep(interval);
          if (!isCurrent()) break;
          lastStepAt = Date.now();
          const result = await enqueueStep(() => simulatorStep());
          // Stopped, or another program loaded: this answer belongs to a program that is gone.
          if (forLoad !== loadId) return;
          if (!result.ok) {
            if (forRun === runId) await stopAt('pause');
            else await publish();
            return;
          }
          registers = result.registers;
          unpublished++;
          unmarked = true;
          if (result.halted) {
            await publish();
            await enterHalted();
            return;
          }
          // Paused (or continued in a new loop) while this instruction was on its way: show it.
          if (forRun !== runId) break;
          const now = Date.now();
          if (now - lastRegistersAt >= FAST_REGISTERS_MS) {
            lastRegistersAt = now;
            await publish();
          }
          if (now - lastViewsAt >= FAST_VIEWS_MS) {
            lastViewsAt = now;
            void refreshMemoryViews('none');
          }
        }
        rateSteps++;
        const elapsed = Date.now() - rateSince;
        if (elapsed >= RATE_WINDOW_MS) {
          set({ rate: Math.round((rateSteps * 1000) / elapsed) });
          rateSince = Date.now();
          rateSteps = 0;
        }
        if (breakpointAt(useListingStore.getState().listings, registers.PC)) {
          await stopAt('breakpoint');
          return;
        }
      }
      // Paused by the user (not stopped, not halted): show where the program stands.
      if (forLoad === loadId && get().isRunning && !get().isHalted && unmarked) {
        await publish();
        flushDeviceStreams('step');
        await refreshMemoryViews('step');
      }
    } catch (error) {
      console.error('Auto-play stopped:', error);
      if (forRun === runId) await stopAt('pause');
    }
  };

  /** Load the program and show it, stopped at its first instruction. False if that failed. */
  const start = () => {
    starting ??= (async () => {
      set({ isStarting: true, loadFailed: false });
      try {
        const forRun = ++runId;
        loadId++;
        // An instruction still on its way must not run in the program loaded next.
        await Promise.race([lastStep, sleep(2000)]);
        if (!(await get().loadProgram())) return false;
        if (forRun !== runId) return false;
        set({
          isRunning: true,
          isPaused: true,
          isHalted: false,
          stopReason: 'start',
          stepCount: 0,
          rate: 0,
        });
        await refreshMemoryViews('none');
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
    isHalted: false,
    stopReason: 'start',
    stepCount: 0,
    rate: 0,
    loadFailed: false,
    delayTime: readSavedInterval(),

    setDelayTime: delayMs => {
      const delayTime = Math.max(0, Math.min(delayMs, MAX_DELAY_MS));
      set({ delayTime });
      saveInterval(delayTime);
    },

    loadProgram: async () => {
      const forRun = runId;
      const { projectPath, settings } = useProjectStore.getState();
      const t = strings();

      // Unsaved edits first, so that the check and the assembler see what is on screen.
      const { success } = await useEditorTabStore.getState().saveAllTabs();
      if (!success) return false;
      if (!(await checkProjectFiles())) return false;
      if (forRun !== runId) return false;

      await emptyOutputFiles();
      const begun = await beginSimulation();
      if (!begun.ok) {
        // For example a file device that cannot be opened (project.sic edited by hand).
        void showError(t.messages.simulatorError, begun.message ?? t.messages.simulatorErrorDetail);
        return false;
      }
      // The memory of an earlier run is gone from the simulator; stop showing it.
      await useMemoryViewStore.getState().reload();

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
        if (Array.isArray(data.files)) {
          publishLoadErrors(data.files, projectPath);
          usePanelStore.getState().setActiveTab('errors');
        } else {
          // No per-file result: the simulator could not even assemble (it says why).
          void showError(
            t.messages.simulatorError,
            data.message ?? t.messages.simulatorErrorDetail,
          );
        }
        await get().stopRunning();
        set({ loadFailed: true });
        return false;
      }
      useRegisterStore.getState().setAll(data.registers);
      simulatorPC = data.registers.PC;
      simulatorRegisters = data.registers;
      startDeviceStreams(
        deviceInstructions(data.files.map(f => f.listing.rows)),
        new Map(
          settings.filedevices
            .filter(d => !skippedDevices.has(d.index))
            .map(d => [d.index, d.filename]),
        ),
      );
      publishLoadedFiles(data.files);
      // While a program runs, the variables are what to watch.
      usePanelStore.getState().setActiveTab('watch');
      useConsoleStore.getState().addRunLine(t.state.logLoaded(settings.asm.join(', ')));
      warnUnconnectedDevices(data.files);
      return true;
    },

    run: async () => {
      if (get().isRunning) await get().stopRunning();
      await start();
    },

    runWithDelay: async () => {
      if (get().isRunning) await get().stopRunning();
      if (await start()) {
        void autoPlay();
      }
    },

    startOrContinue: async () => {
      const { isRunning, isHalted, isPaused, isStarting } = get();
      if (isStarting) return;
      if (!isRunning || isHalted) await get().runWithDelay();
      else if (isPaused) get().resume();
    },

    stepOrStart: async () => {
      const { isRunning, isHalted, isPaused, isStarting } = get();
      if (isStarting || isHalted) return;
      if (!isRunning) await get().run();
      else if (isPaused) await get().stepOnce();
    },

    resume: () => {
      if (get().isRunning && !get().isHalted) {
        void autoPlay();
      }
    },

    pause: () => {
      if (!get().isRunning || get().isPaused) return;
      runId++;
      set({ isPaused: true, stopReason: 'pause', rate: 0 });
    },

    stepOnce: async () => {
      if (get().isRunning && get().isPaused && !get().isHalted) {
        set({ stopReason: 'step' });
        await executeStep(runId, 'step');
      }
    },

    restart: async () => {
      await get().stopRunning();
      await start();
    },

    stopRunning: async () => {
      runId++;
      loadId++;
      // The streams stay (what the program wrote is worth reading after it); a new run starts
      // new ones.
      stopDeviceRecording();
      // Whatever the simulator answers, the run is over for the user.
      useListingStore.getState().clearListings();
      useEditorTabStore.getState().closeListingTabs();
      useWatchStore.getState().clearWatch();
      set({ isPaused: true, isRunning: false, isHalted: false, stopReason: 'start', rate: 0 });
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
