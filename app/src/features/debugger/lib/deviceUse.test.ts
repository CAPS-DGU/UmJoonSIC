import { describe, expect, it } from 'vitest';
import type { ListingRow } from '@/api/types';
import { deviceHex, devicesUsed } from './deviceUse';

const row = (label: string, instr: string, operand: string, rawCodeHex = ''): ListingRow => ({
  addressHex: '000000',
  rawCodeHex,
  rawCodeBinary: '',
  label,
  instr,
  instrHex: '',
  instrBin: '',
  nixbpe: '',
  operand,
  comment: '',
  labelWidth: 0,
  nameWidth: 0,
  isCommentRow: false,
});

describe('devices a program uses', () => {
  it('reads the device number from the BYTE the operand names', () => {
    const rows = [
      row('LOOP', 'TD', 'INDEV'),
      row('', 'RD', 'INDEV'),
      row('', 'WD', 'OUTDEV'),
      row('INDEV', 'BYTE', "X'F1'", 'F1'),
      row('OUTDEV', 'BYTE', "X'05'", '05'),
    ];
    expect(devicesUsed([rows])).toEqual([
      { device: 5, access: 'write' },
      { device: 0xf1, access: 'read' },
      { device: 0xf1, access: 'test' },
    ]);
  });

  it('handles indexed operands and the extended format', () => {
    const rows = [row('', '+WD', 'DEV,X'), row('DEV', 'BYTE', "X'02'", '02')];
    expect(devicesUsed([rows])).toEqual([{ device: 2, access: 'write' }]);
  });

  it('ignores operands it cannot resolve', () => {
    expect(devicesUsed([[row('', 'WD', 'NOWHERE')]])).toEqual([]);
  });

  it('writes device numbers as two hex digits', () => {
    expect(deviceHex(5)).toBe('05');
    expect(deviceHex(0xf1)).toBe('F1');
  });
});
