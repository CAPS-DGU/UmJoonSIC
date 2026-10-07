// What a running program reads from and writes to each device (the Devices panel).
//
// The simulator is not asked (it may not be changed): every instruction goes through
// runningStore's step queue, which knows the PC before the step and the registers before and
// after. When that instruction is an RD, WD or TD (from the listing), the byte is known:
//   WD writes the rightmost byte of A as it was before the step;
//   RD reads into the rightmost byte of A, as it is after the step;
//   TD tests the device: CC is < (SW 0x40) after it if the device is ready, = if not.
// This works for every device, connected to a file or not, and in every run mode.
import { create } from 'zustand';
import type { Registers } from '@/api/types';
import type { DeviceAccess, DeviceInstruction } from '@/features/debugger/lib/deviceUse';
import type { MarkMode } from '@/lib/changeMarks';

/** Bytes kept per device and direction; earlier ones are counted, not kept. */
export const KEPT_BYTES = 64 * 1024;

export interface DeviceStream {
  device: number;
  /** The symbols naming it in the program (e.g. OUTDEV). */
  labels: string[];
  /** How the program uses it, from its instructions. */
  uses: DeviceAccess[];
  /** The file the device was connected to when the run began (as in project.sic), if any. */
  file: string | null;
  /** The last bytes the program read (RD), in order; `readCount` in all. */
  read: number[];
  readCount: number;
  /** The last bytes the program wrote (WD), in order; `writtenCount` in all. */
  written: number[];
  writtenCount: number;
  /** How many times the program tested it (TD). */
  tests: number;
  /** TD's "not ready" answers in a row, the latest instruction on the device included. */
  notReady: number;
}

/** Bytes added to a stream in the last update that marks changes (lib/changeMarks). */
export interface FreshBytes {
  read: number;
  written: number;
}

interface DeviceStreamState {
  /** The devices of the last program loaded, by number; kept after it ends or is stopped. */
  streams: DeviceStream[];
  /** Counts the loads: what was read for one run (an input file) is read again. */
  generation: number;
  /** The bytes each device got in the last marked update; the panel flashes them. */
  fresh: ReadonlyMap<number, FreshBytes>;
  /** When each device's stream last grew (Date.now()): its activity light. */
  activity: ReadonlyMap<number, number>;
  /** A stream grew since the Devices tab was last shown: the tab gets a dot. */
  unseen: boolean;
  markSeen: () => void;
}

export const useDeviceStreamStore = create<DeviceStreamState>(set => ({
  streams: [],
  generation: 0,
  fresh: new Map(),
  activity: new Map(),
  unseen: false,
  markSeen: () => set({ unseen: false }),
}));

/** The RD/WD/TD instructions of the loaded program, by address. */
let byAddress = new Map<number, DeviceInstruction>();

interface Pending {
  read: number[];
  written: number[];
  tests: number;
  /** "Not ready" answers in a row at the end of these instructions. */
  notReady: number;
  /** One of these instructions ended a row of "not ready" answers (RD, WD, a ready TD). */
  notReadyBroken: boolean;
}
/** Instructions recorded but not shown yet. */
const pending = new Map<number, Pending>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** How often a fast run updates the panel (it records every instruction regardless). */
const FLUSH_MS = 100;
function stopTimer() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}

/**
 * A program was loaded: its devices, with empty streams. `files`: the devices the simulator
 * got connected, with their files as in project.sic.
 */
export function startDeviceStreams(
  instructions: DeviceInstruction[],
  files: ReadonlyMap<number, string>,
) {
  byAddress = new Map(instructions.map(i => [i.address, i]));
  pending.clear();
  stopTimer();
  const devices = new Map<number, DeviceStream>();
  for (const { device, access, label } of instructions) {
    const stream = devices.get(device) ?? {
      device,
      labels: [],
      uses: [],
      file: files.get(device) ?? null,
      read: [],
      readCount: 0,
      written: [],
      writtenCount: 0,
      tests: 0,
      notReady: 0,
    };
    if (label && !stream.labels.includes(label)) stream.labels.push(label);
    if (!stream.uses.includes(access)) stream.uses.push(access);
    devices.set(device, stream);
  }
  useDeviceStreamStore.setState(state => ({
    streams: [...devices.values()].sort((a, b) => a.device - b.device),
    generation: state.generation + 1,
    fresh: new Map(),
    activity: new Map(),
    unseen: false,
  }));
}

/** The run was stopped: show what was recorded, keep it, record no more. */
export function stopDeviceRecording() {
  flushDeviceStreams('none');
  byAddress = new Map();
}

/** Another project: nothing to show. */
export function clearDeviceStreams() {
  byAddress = new Map();
  pending.clear();
  stopTimer();
  useDeviceStreamStore.setState({
    streams: [],
    fresh: new Map(),
    activity: new Map(),
    unseen: false,
  });
}

/** One executed instruction: the PC it was at, and the registers before and after it. */
export function recordDeviceStep(pcBefore: number, before: Registers, after: Registers) {
  const instruction = byAddress.get(pcBefore);
  if (!instruction) return;
  const entry = pending.get(instruction.device) ?? {
    read: [],
    written: [],
    tests: 0,
    notReady: 0,
    notReadyBroken: false,
  };
  if (instruction.access === 'test') {
    entry.tests += 1;
    if ((after.SW & 0xc0) === 0x40) {
      entry.notReady = 0;
      entry.notReadyBroken = true;
    } else entry.notReady += 1;
  } else {
    if (instruction.access === 'write') entry.written.push(before.A & 0xff);
    else entry.read.push(after.A & 0xff);
    entry.notReady = 0;
    entry.notReadyBroken = true;
  }
  pending.set(instruction.device, entry);
  // A fast run is shown now and then; a step, a pause or the end flush at once.
  flushTimer ??= setTimeout(() => flushDeviceStreams('none'), FLUSH_MS);
}

/** `bytes` after `kept`, of which only the last KEPT_BYTES are kept. */
const append = (kept: number[], bytes: number[]) =>
  bytes.length === 0 ? kept : [...kept, ...bytes].slice(-KEPT_BYTES);

/**
 * Show what was recorded. Unless `mode` is `none` (a fast run), the bytes it adds are marked
 * as new until the next update, as the memory viewer and the Watch mark changed values; the
 * marks of the last update go. Each new byte flashes once: nothing strobes while auto-playing.
 */
export function flushDeviceStreams(mode: MarkMode) {
  stopTimer();
  const fresh = new Map<number, FreshBytes>();
  if (mode !== 'none') {
    for (const [device, entry] of pending) {
      // A TD alone adds no byte: it lights the activity light only.
      if (entry.read.length + entry.written.length > 0) {
        fresh.set(device, { read: entry.read.length, written: entry.written.length });
      }
    }
  }
  const active = [...pending.keys()];
  const grew = active.some(d => pending.get(d)!.read.length + pending.get(d)!.written.length);
  const now = Date.now();
  useDeviceStreamStore.setState(state => {
    const activity = new Map(state.activity);
    for (const device of active) activity.set(device, now);
    return {
      streams: state.streams.map(stream => {
        const entry = pending.get(stream.device);
        if (!entry) return stream;
        return {
          ...stream,
          read: append(stream.read, entry.read),
          readCount: stream.readCount + entry.read.length,
          written: append(stream.written, entry.written),
          writtenCount: stream.writtenCount + entry.written.length,
          tests: stream.tests + entry.tests,
          notReady: entry.notReadyBroken ? entry.notReady : stream.notReady + entry.notReady,
        };
      }),
      fresh,
      activity,
      unseen: state.unseen || grew,
    };
  });
  pending.clear();
}
