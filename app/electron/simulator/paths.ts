// Where the app keeps the simulator (JRE + simulator.jar) on this machine.
import path from 'path';
import { app } from 'electron';
import { getPreferences } from '../preferences';

let portAtStart: number | null = null;

/**
 * The port the simulator listens on: the preference as it was when the app started (a change
 * applies at the next start). The renderer asks for it (waitForSimulator), so both sides
 * always use the same number.
 */
export function simulatorPort(): number {
  portAtStart ??= getPreferences().simulatorPort;
  return portAtStart;
}

/** <appData>/umjoonsic: JRE, simulator.jar and downloaded archives live here. */
export function getSimulatorDataDir() {
  return path.join(app.getPath('appData'), 'umjoonsic');
}

/** Directory name inside the Temurin JRE archive; must match the download URLs in jre.ts. */
export const jdkFullName = 'jdk-17.0.16+8-jre';

export function getJavaPath() {
  const appDataPath = getSimulatorDataDir();
  if (process.platform === 'win32') {
    return path.join(appDataPath, 'jre', 'bin', 'java.exe');
  } else if (process.platform === 'darwin') {
    return path.join(appDataPath, jdkFullName, 'Contents', 'Home', 'bin', 'java');
  } else if (process.platform === 'linux') {
    return path.join(appDataPath, jdkFullName, 'bin', 'java');
  }
  return null;
}

export function getServerPath() {
  const appDataPath = getSimulatorDataDir();
  return path.join(appDataPath, 'simulator.jar');
}
