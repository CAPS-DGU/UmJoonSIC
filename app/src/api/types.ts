// Shapes of the simulator's HTTP API (simulator/src/main/java/com/sicserver).

export type MachineMode = 'SIC' | 'SICXE';

export interface Registers {
  A: number;
  X: number;
  L: number;
  S: number;
  T: number;
  B: number;
  SW: number;
  PC: number;
  /** The floating-point register arrives as a decimal string. */
  F: string;
}

export interface AssemblerError {
  row: number;
  col: number;
  length?: number;
  message: string;
  nonbreaking: boolean;
}

export interface LinkerError {
  /** e.g. "linker", "options", "first-pass", "second-pass" */
  phase: string;
  msg: string;
}

/** One row of an assembly listing. */
export interface ListingRow {
  addressHex: string;
  rawCodeHex: string;
  rawCodeBinary: string;
  label: string;
  instr: string;
  instrHex: string;
  instrBin: string;
  nixbpe: string;
  operand: string;
  comment: string;
  labelWidth: number;
  nameWidth: number;
  isCommentRow: boolean;
}

/** A labelled storage area the Watch panel can show. */
export interface WatchVariable {
  name: string;
  address: number;
  dataType: string;
  elementSize: number;
  elementCount: number;
}

export interface Listing {
  codeFileName: string;
  startAddress: number;
  programLength: number;
  rows: ListingRow[];
  watch: WatchVariable[];
}

export interface LoadedFile {
  fileName: string;
  listing: Listing;
  assemblerErrors?: AssemblerError[];
  linkerError?: LinkerError;
}

export interface SimulatorMessage {
  ok: boolean;
  message?: string;
}

export interface LoadRequest {
  /** Absolute paths of the .asm files to assemble (and link, if several). */
  filePaths: string[];
  outputDir: string;
  /** Entry module name; omitted when the project sets none. */
  main?: string;
}

export interface LoadResponse extends SimulatorMessage {
  files: LoadedFile[];
  registers: Registers;
}

export interface StepResponse extends SimulatorMessage {
  registers: Registers;
}

export interface MemoryResponse {
  values: number[];
}

export interface SyntaxCheckFileResult {
  fileName: string;
  ok: boolean;
  assemblerErrors?: AssemblerError[] | null;
}

export interface SyntaxCheckResult {
  ok: boolean;
  message: string;
  files: SyntaxCheckFileResult[];
}
