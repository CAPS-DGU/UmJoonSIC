export interface AssemblerError {
  row: number;
  col: number;
  length?: number;
  message: string;
  nonbreaking: boolean;
}

export interface LinkerError {
  phase: string; // e.g., "linker", "options", "first-pass", "second-pass"
  msg: string; // human-readable message
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
