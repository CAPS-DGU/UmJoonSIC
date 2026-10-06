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

// 127.0.0.1, as the simulator binds IPv4 only ('localhost' may try IPv6 first).
const BASE_URL = 'http://127.0.0.1:9090';

/**
 * Resolves once the main process has said the simulator accepts requests. Kept: asking before
 * every request was an IPC round trip per request (hundreds a second in a fast run). Asked
 * again after a request could not reach the simulator.
 */
let ready: Promise<void> | null = null;

function simulatorReady(): Promise<void> {
  if (!ready) {
    const asked = window.api.waitForSimulator().then(res => {
      if (!res.success) {
        throw new Error(`Simulator is not available: ${res.message ?? 'unknown error'}`);
      }
    });
    ready = asked;
    // A failed wait is not kept: the next request asks again.
    asked.catch(() => {
      if (ready === asked) ready = null;
    });
  }
  return ready;
}

/**
 * POST JSON and parse the JSON answer. Waits while the simulator is still starting (or
 * restarting from the Server panel), so an early request does not fail. An HTTP error
 * status throws; the simulator reports its own errors as `{ ok: false }` with status 200.
 */
async function post<T>(route: string, body: unknown): Promise<T> {
  const send = async () => {
    await simulatorReady();
    return fetch(`${BASE_URL}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };
  let res: Response;
  try {
    res = await send();
  } catch {
    // Not reachable (restarting, say): wait until the main process reports it ready, once.
    ready = null;
    res = await send();
  }
  if (!res.ok) {
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
  step: () => post<StepResponse>('/step', {}),

  /** Read memory from `start` to `end`, both inclusive. */
  memory: (start: number, end: number) => post<MemoryResponse>('/memory', { start, end }),

  /** Assemble the given texts without loading them; returns the errors per file. */
  syntaxCheck: (texts: string[], fileNames: string[]) =>
    post<SyntaxCheckResult>('/syntax-check', { texts, fileNames }),
};
