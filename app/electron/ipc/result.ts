import type { IpcResult } from '../../shared/ipc';

export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
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
    return { success: false, message: toErrorMessage(error) };
  }
}
