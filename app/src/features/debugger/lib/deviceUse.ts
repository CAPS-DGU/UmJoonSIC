// Which devices a loaded program uses, read from its listing: RD, WD and TD name a byte in
// memory that holds the device number (e.g. OUTDEV BYTE X'05'). Used before a run to warn
// about devices that are not connected to a file (the simulator then discards what is
// written, reads 0, and TD never reports ready).
import type { ListingRow } from '@/api/types';

export type DeviceAccess = 'read' | 'write' | 'test';

export interface DeviceUse {
  device: number;
  access: DeviceAccess;
}

const ACCESS: Record<string, DeviceAccess> = { RD: 'read', WD: 'write', TD: 'test' };

/** The symbol an operand names: without # @ ,X and an extended-format +. */
function operandSymbol(operand: string) {
  return operand
    .trim()
    .replace(/^[#@=]/, '')
    .split(',')[0]
    .trim();
}

/** The device numbers used by RD/WD/TD in these listings (one entry per device and access). */
export function devicesUsed(listings: ListingRow[][]): DeviceUse[] {
  const found = new Map<string, DeviceUse>();
  for (const rows of listings) {
    const byLabel = new Map(rows.filter(r => r.label).map(r => [r.label.trim().toUpperCase(), r]));
    for (const row of rows) {
      const access = ACCESS[row.instr.trim().replace(/^\+/, '').toUpperCase()];
      if (!access) continue;
      const symbol = operandSymbol(row.operand).toUpperCase();
      let device: number | undefined;
      const target = byLabel.get(symbol);
      if (target && target.rawCodeHex.length >= 2) {
        device = parseInt(target.rawCodeHex.slice(0, 2), 16);
      } else if (/^X'[0-9A-F]{1,2}'$/.test(symbol)) {
        // A literal or a hex constant written in place.
        device = parseInt(symbol.slice(2, -1), 16);
      }
      if (device === undefined || Number.isNaN(device)) continue;
      found.set(`${device}:${access}`, { device, access });
    }
  }
  return [...found.values()].sort(
    (a, b) => a.device - b.device || a.access.localeCompare(b.access),
  );
}

/** "05", "F1": a device number as students write it. */
export const deviceHex = (device: number) => device.toString(16).toUpperCase().padStart(2, '0');
