import type { IpcResult } from '../../shared/ipc';

export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

/** An error with a code the page explains in its own language (see IpcResult.code). */
export class CodedError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Run an IPC handler body. A returned value becomes `{ success: true, data }` (no `data`
 * key when the body returns nothing); a thrown error becomes `{ success: false, message }`.
 * Handlers never reject.
 */
export async function ipcResult<T>(body: () => T | Promise<T>): Promise<IpcResult<T>> {
  try {
    const data = await body();
    return data === undefined ? { success: true } : { success: true, data };
  } catch (error) {
    const code =
      error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    return { success: false, message: toErrorMessage(error), ...(code && { code }) };
  }
}
