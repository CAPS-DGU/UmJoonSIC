import type { IpcResult } from '../../shared/ipc';

export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Run an IPC handler body. A returned value becomes `{ success: true, data }`;
 * a thrown error becomes `{ success: false, message }`. Handlers never reject.
 */
export async function ipcResult<T>(body: () => T | Promise<T>): Promise<IpcResult<T>> {
  try {
    return { success: true, data: await body() };
  } catch (error) {
    return { success: false, message: toErrorMessage(error) };
  }
}
