// The simulator process: `java -jar simulator.jar <port>`, serving HTTP on the simulator port (paths.ts).
// The app runs one at a time: started at launch, restarted from the Server panel, killed on quit.
import { texts } from '../i18n';
import { BrowserWindow } from 'electron';
import { type ChildProcess, spawn } from 'child_process';
import net from 'node:net';
import { AppEvent, type ServerLogPayload } from '../../shared/ipc';
import { checkJARUpdate } from './jar';
import { getJavaPath, getServerPath, simulatorPort } from './paths';

const HOST = '127.0.0.1';
/** How long the JVM may take until the simulator accepts connections. */
const START_TIMEOUT_MS = 30_000;
/** How long a previous simulator may hold the port before a new one is started anyway. */
const PORT_RELEASE_TIMEOUT_MS = 5000;
const STOP_TIMEOUT_MS = 3000;
const POLL_MS = 150;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** How many chunks of output are kept for a renderer that starts listening late. */
const LOG_HISTORY_SIZE = 1000;
const logHistory: ServerLogPayload[] = [];
let nextLogSeq = 0;

/** Record a line of simulator output and send it to every window (the Server panel shows it). */
export function logServerOutput(type: ServerLogPayload['type'], message: string) {
  const payload: ServerLogPayload = { seq: nextLogSeq++, type, message };
  logHistory.push(payload);
  if (logHistory.length > LOG_HISTORY_SIZE) {
    logHistory.shift();
  }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send(AppEvent.serverLog, payload);
    }
  }
}

/** The recorded output, oldest first. */
export function serverLogHistory(): ServerLogPayload[] {
  return [...logHistory];
}

/** True if something accepts TCP connections on the port. */
function isListening(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.connect(port, HOST);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

/** Wait until nothing listens on the port any more, or give up after `timeoutMs`. */
async function waitForPortRelease(port: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && (await isListening(port))) {
    await sleep(POLL_MS);
  }
}

/** Put the simulator into SIC mode. Fails while it is not (yet) accepting requests. */
async function beginSimulation() {
  const res = await fetch(`http://${HOST}:${simulatorPort()}/begin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'sic' }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as { message?: string };
  console.log('Server initialized:', data.message);
}

/** A promise with its settle functions, so that it can be settled from outside. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const state = { settled: false };
  const promise = new Promise<void>((res, rej) => {
    resolve = () => {
      state.settled = true;
      res();
    };
    reject = error => {
      state.settled = true;
      rej(error);
    };
  });
  // Nobody may be waiting when it fails; that is not an unhandled rejection.
  promise.catch(() => {});
  return { promise, resolve, reject, state };
}

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

class SimulatorProcess {
  /** The process this app started; null when none runs (or one started elsewhere is used). */
  private child: ChildProcess | null = null;
  /** Settles when the simulator of the current start is ready, or failed to start. */
  private readiness = deferred();
  /** Start, stop and restart run one at a time, in the order they were asked for. */
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * Resolves once the simulator accepts requests. While it is (re)starting, this waits for
   * the new process; if that fails to start, it rejects with the reason.
   */
  whenReady(): Promise<void> {
    return this.readiness.promise;
  }

  /** Start the simulator (unless it runs) and wait until it is ready. Throws if it cannot start. */
  start(): Promise<void> {
    return this.serially(() => this.startNow());
  }

  /** Stop the simulator, bring simulator.jar up to date and start it again. */
  restart(): Promise<void> {
    return this.serially(async () => {
      await this.stopNow();
      await checkJARUpdate();
      await this.startNow();
    });
  }

  /** Ask the current process to exit, without waiting. Used when the app quits. */
  kill() {
    this.child?.kill();
    this.child = null;
  }

  private serially<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  private isRunning() {
    return this.child !== null && this.child.exitCode === null && this.child.signalCode === null;
  }

  private async startNow() {
    // macOS re-creates the window from the dock while the app (and the simulator) live on.
    if (this.isRunning() && this.readiness.state.settled) return;
    if (this.readiness.state.settled) this.readiness = deferred();
    const readiness = this.readiness;
    try {
      await this.launch();
      readiness.resolve();
    } catch (error) {
      this.kill();
      readiness.reject(toError(error));
      throw toError(error);
    }
  }

  /** Stop the simulator and wait (up to a few seconds) for it to exit. */
  private async stopNow() {
    const child = this.child;
    // Requests made from now on wait for the next start.
    if (this.readiness.state.settled) this.readiness = deferred();
    if (!child) return;
    const exited = new Promise<void>(resolve => child.once('close', () => resolve()));
    this.kill();
    await Promise.race([exited, sleep(STOP_TIMEOUT_MS)]);
  }

  private async launch() {
    const javaPath = getJavaPath();
    if (!javaPath) {
      throw new Error(texts().javaNotFound);
    }
    await waitForPortRelease(simulatorPort(), PORT_RELEASE_TIMEOUT_MS);
    if (await isListening(simulatorPort())) {
      // Most likely the simulator of an earlier session that ended abnormally. A second one
      // could not open the port; use that one if it answers (it is not ours to stop).
      console.warn(`Port ${simulatorPort()} is in use; using the simulator that answers there.`);
      await beginSimulation().catch(error => {
        throw new Error(
          texts().portInUse(simulatorPort(), String(error)),
        );
      });
      return;
    }

    // windowsHide: no console window for java.exe on Windows.
    const child = spawn(javaPath, ['-jar', getServerPath(), String(simulatorPort())], {
      windowsHide: true,
    });
    this.child = child;

    child.stdout.on('data', data => {
      const text = String(data);
      console.log(text);
      logServerOutput('out', text);
    });
    child.stderr.on('data', data => {
      const text = String(data);
      console.error(text);
      logServerOutput('error', text);
    });
    child.on('close', code => {
      const message = `Server stopped: ${code}`;
      console.log(message);
      logServerOutput('out', message);
      if (this.child === child) {
        this.child = null;
      }
    });

    // Starting fails if Java cannot be run, or if the process exits before it is ready.
    let gaveUp = false;
    const failed = new Promise<never>((_, reject) => {
      child.once('error', reject);
      child.once('exit', code => reject(new Error(texts().exitedWhileStarting(String(code)))));
    });
    // Ready means: the first /begin succeeds. Before that, the port is closed or the
    // routes are not registered yet, so keep trying until the deadline.
    const ready = (async () => {
      const deadline = Date.now() + START_TIMEOUT_MS;
      for (;;) {
        try {
          await beginSimulation();
          return;
        } catch (error) {
          if (gaveUp) return;
          if (Date.now() > deadline) {
            throw new Error(
              texts().startTimeout(START_TIMEOUT_MS / 1000, String(error)),
            );
          }
          await sleep(POLL_MS);
        }
      }
    })();
    try {
      await Promise.race([ready, failed]);
    } finally {
      gaveUp = true;
    }
  }
}

export const simulatorProcess = new SimulatorProcess();
