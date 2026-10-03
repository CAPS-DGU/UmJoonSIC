// Client for the simulator: the Java server that the main process starts on
// port 9090 (electron/simulator/paths.ts holds the same number). Every endpoint
// is a POST with a JSON body.
import type { FileDevice } from '@shared/ipc';
import type {
  LoadRequest,
  LoadResponse,
  MachineMode,
  MemoryResponse,
  SimulatorMessage,
  StepResponse,
  SyntaxCheckResult,
} from '@/api/types';

const BASE_URL = 'http://localhost:9090';

/**
 * POST JSON and parse the JSON answer. By default an HTTP error status throws, as the
 * axios calls did before; `rejectHttpErrors: false` keeps the old fetch behaviour of
 * reading the body anyway (the simulator answers errors with a JSON `{ ok: false }`).
 */
async function post<T>(route: string, body: unknown, rejectHttpErrors = true): Promise<T> {
  const res = await fetch(`${BASE_URL}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (rejectHttpErrors && !res.ok) {
    throw new Error(`Simulator request ${route} failed with HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const simulator = {
  /** Start a fresh simulation in the given machine mode. Discards loaded programs and registers. */
  begin: (mode: MachineMode, filedevices?: FileDevice[]) =>
    post<SimulatorMessage>('/begin', { type: mode.toLowerCase(), filedevices }),

  /** Assemble (and link) the files and load the result into memory. */
  load: (request: LoadRequest) => post<LoadResponse>('/load', request),

  /** Execute one instruction. */
  step: () => post<StepResponse>('/step', {}, false),

  /** Read memory from `start` to `end`. */
  memory: (start: number, end: number) => post<MemoryResponse>('/memory', { start, end }),

  /** Assemble the given texts without loading them; returns the errors per file. */
  syntaxCheck: (texts: string[], fileNames: string[]) =>
    post<SyntaxCheckResult>('/syntax-check', { texts, fileNames }),
};
