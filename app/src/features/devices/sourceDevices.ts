// The devices a program uses, read from its source before it is assembled (the project
// settings and the New File dialog suggest them). The listing-based deviceUse.ts is exact
// after a load; this reads the same things from the text: RD/WD/TD and the BYTE they name.
import type { DeviceAccess } from '@/features/debugger/lib/deviceUse';

export interface SourceDevice {
  device: number;
  /** How the program uses it. */
  uses: DeviceAccess[];
  /** The symbols naming it (e.g. OUTDEV). */
  labels: string[];
}

const ACCESS: Record<string, DeviceAccess> = { RD: 'read', WD: 'write', TD: 'test' };

/** A source line's fields: label (if the line does not start with a blank), operation, operand. */
function fields(line: string) {
  if (/^\s*\./.test(line) || line.trim() === '') return null;
  const startsBlank = /^\s/.test(line);
  // Quoted constants (C'A B') may hold blanks: keep them in one field.
  const parts = line.trim().match(/[^\s']*'[^']*'[^\s]*|\S+/g) ?? [];
  const [label, op, operand] = startsBlank
    ? ['', parts[0], parts[1]]
    : [parts[0], parts[1], parts[2]];
  return {
    label: (label ?? '').toUpperCase(),
    op: (op ?? '').toUpperCase(),
    operand: operand ?? '',
  };
}

/** The device numbers used by RD/WD/TD in these sources (all files of a program together). */
export function devicesInSources(sources: string[]): SourceDevice[] {
  const bytes = new Map<string, number>();
  const uses: { symbol: string; access: DeviceAccess }[] = [];
  for (const source of sources) {
    for (const line of source.split(/\r?\n/)) {
      const f = fields(line);
      if (!f) continue;
      if (f.op === 'BYTE' && f.label) {
        const hex = f.operand.match(/^X'([0-9A-F]{1,2})'/i);
        if (hex) bytes.set(f.label, parseInt(hex[1], 16));
      }
      const access = ACCESS[f.op.replace(/^\+/, '')];
      if (access) {
        const symbol = f.operand
          .replace(/^[#@=]/, '')
          .split(',')[0]
          .toUpperCase();
        uses.push({ symbol, access });
      }
    }
  }
  const found = new Map<number, SourceDevice>();
  for (const { symbol, access } of uses) {
    const inline = symbol.match(/^X'([0-9A-F]{1,2})'$/);
    const device = inline ? parseInt(inline[1], 16) : bytes.get(symbol);
    if (device === undefined) continue;
    const entry = found.get(device) ?? { device, uses: [], labels: [] };
    if (!entry.uses.includes(access)) entry.uses.push(access);
    if (!inline && !entry.labels.includes(symbol)) entry.labels.push(symbol);
    found.set(device, entry);
  }
  return [...found.values()].sort((a, b) => a.device - b.device);
}

/**
 * The control sections a source defines (START and CSECT labels, as written): the names
 * project.sic's main can give. The linker matches main against them exactly.
 */
export function sectionsInSource(source: string): string[] {
  const names: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (/^\s/.test(line) || /^\./.test(line)) continue;
    const [label, op] = line.trim().split(/\s+/);
    if (label && /^(START|CSECT)$/i.test(op ?? '') && !names.includes(label)) names.push(label);
  }
  return names;
}

/** Instructions and directives only SIC/XE has (format 2, floating point, linking, base). */
const XE_ONLY = new Set(
  (
    'ADDF ADDR CLEAR COMPF COMPR DIVF DIVR FIX FLOAT HIO LDB LDF LDS LDT LPS MULF MULR NORM ' +
    'RMO SHIFTL SHIFTR SIO SSK STB STF STI STS STT SUBF SUBR SVC TIO TIXR BASE NOBASE CSECT ' +
    'EXTDEF EXTREF'
  ).split(' '),
);

/**
 * The machine a source is written for: SIC/XE if it uses format 4 (+), immediate (#) or
 * indirect (@) operands, or an instruction or directive only SIC/XE has; else SIC. Used for
 * the project made for a file opened on its own.
 */
export function machineModeOf(source: string): 'SIC' | 'SICXE' {
  for (const line of source.split(/\r?\n/)) {
    const f = fields(line);
    if (!f) continue;
    if (f.op.startsWith('+') || /^[#@]/.test(f.operand) || XE_ONLY.has(f.op)) return 'SICXE';
  }
  return 'SIC';
}
