// Where the app keeps the simulator (JRE + simulator.jar) on this machine.
import path from 'path';
import { app } from 'electron';

/** Port the simulator listens on. The renderer uses the same number (src/api/simulator.ts). */
export const SIMULATOR_PORT = 9090;

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
