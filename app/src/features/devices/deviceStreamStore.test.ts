import { beforeEach, describe, expect, it } from 'vitest';
import type { Registers } from '@/api/types';
import {
  clearDeviceStreams,
  flushDeviceStreams,
  KEPT_BYTES,
  recordDeviceStep,
  startDeviceStreams,
  useDeviceStreamStore,
} from './deviceStreamStore';

const regs = (A: number, PC: number, SW = 0): Registers => ({
  A,
  X: 0,
  L: 0,
  S: 0,
  T: 0,
  B: 0,
  SW,
  PC,
  F: '0',
});

describe('device streams', () => {
  beforeEach(() => {
    clearDeviceStreams();
    startDeviceStreams(
      [
        { address: 0x06, device: 0xf1, access: 'test', label: 'INDEV' },
        { address: 0x0c, device: 0xf1, access: 'read', label: 'INDEV' },
        { address: 0x0f, device: 5, access: 'write', label: 'OUTDEV' },
      ],
      new Map([[0xf1, 'input.txt']]),
    );
  });

  it('lists the program’s devices with their names and uses', () => {
    const streams = useDeviceStreamStore.getState().streams;
    expect(streams.map(s => [s.device, s.labels, s.uses, s.file])).toEqual([
      [5, ['OUTDEV'], ['write'], null],
      [0xf1, ['INDEV'], ['test', 'read'], 'input.txt'],
    ]);
  });

  it('records what WD wrote (A before) and RD read (A after), and TD tests', () => {
    recordDeviceStep(0x06, regs(0, 0x06), regs(0, 0x09));
    recordDeviceStep(0x0c, regs(0, 0x0c), regs(0x41, 0x0f));
    recordDeviceStep(0x0f, regs(0x41, 0x0f), regs(0x41, 0x12));
    recordDeviceStep(0x20, regs(0x99, 0x20), regs(0x99, 0x23)); // not a device instruction
    flushDeviceStreams('step');
    const { streams, fresh, unseen } = useDeviceStreamStore.getState();
    expect(streams.find(s => s.device === 5)?.written).toEqual([0x41]);
    expect(streams.find(s => s.device === 0xf1)?.read).toEqual([0x41]);
    expect(streams.find(s => s.device === 0xf1)?.tests).toBe(1);
    expect(fresh.get(5)).toEqual({ read: 0, written: 1 });
    expect(fresh.get(0xf1)).toEqual({ read: 1, written: 0 });
    expect(unseen).toBe(true);
  });

  it('counts TD\'s "not ready" answers in a row; RD or a ready answer ends the row', () => {
    const notReady = () => useDeviceStreamStore.getState().streams[1].notReady;
    for (let i = 0; i < 3; i++) recordDeviceStep(0x06, regs(0, 0x06), regs(0, 0x09, 0));
    flushDeviceStreams('none');
    expect(notReady()).toBe(3);
    recordDeviceStep(0x06, regs(0, 0x06), regs(0, 0x09, 0));
    flushDeviceStreams('step');
    expect(notReady()).toBe(4);
    // A TD alone lights the activity, it does not mark the stream.
    expect(useDeviceStreamStore.getState().fresh.size).toBe(0);
    expect(useDeviceStreamStore.getState().activity.has(0xf1)).toBe(true);
    recordDeviceStep(0x06, regs(0, 0x06), regs(0, 0x09, 0x40));
    recordDeviceStep(0x06, regs(0, 0x06), regs(0, 0x09, 0));
    flushDeviceStreams('step');
    expect(notReady()).toBe(1);
  });

  it('marks the bytes of the last update only', () => {
    recordDeviceStep(0x0f, regs(0x41, 0x0f), regs(0x41, 0x12));
    flushDeviceStreams('playing');
    recordDeviceStep(0x0f, regs(0x42, 0x0f), regs(0x42, 0x12));
    recordDeviceStep(0x0f, regs(0x43, 0x0f), regs(0x43, 0x12));
    flushDeviceStreams('playing');
    expect(useDeviceStreamStore.getState().fresh.get(5)).toEqual({ read: 0, written: 2 });
    flushDeviceStreams('step');
    expect(useDeviceStreamStore.getState().fresh.size).toBe(0);
  });

  it('keeps the last bytes only, and counts them all', () => {
    for (let i = 0; i < KEPT_BYTES + 10; i++) {
      recordDeviceStep(0x0f, regs(i, 0x0f), regs(i, 0x12));
    }
    flushDeviceStreams('none');
    const out = useDeviceStreamStore.getState().streams[0];
    expect(out.written.length).toBe(KEPT_BYTES);
    expect(out.writtenCount).toBe(KEPT_BYTES + 10);
    expect(out.written[0]).toBe(10 & 0xff);
  });

  it('keeps the low byte of A only', () => {
    recordDeviceStep(0x0f, regs(0x123456, 0x0f), regs(0x123456, 0x12));
    flushDeviceStreams('none');
    expect(useDeviceStreamStore.getState().streams[0].written).toEqual([0x56]);
    // Not marked: a fast run does not flash.
    expect(useDeviceStreamStore.getState().fresh.size).toBe(0);
  });
});
