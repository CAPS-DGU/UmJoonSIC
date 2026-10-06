// The Java runtime the simulator runs on: downloaded on first start (Eclipse Temurin 17).
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import AdmZip from 'adm-zip';
import { downloadFile, type DownloadStep } from './download';
import { getJavaPath, getSimulatorDataDir } from './paths';

const TEMURIN_RELEASE =
  'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.16%2B8';

/** Archive per platform and CPU. The folder inside must match `jdkFullName` (paths.ts). */
const JRE_ARCHIVES: Partial<Record<NodeJS.Platform, Partial<Record<string, string>>>> = {
  win32: { x64: 'OpenJDK17U-jre_x64_windows_hotspot_17.0.16_8.zip' },
  darwin: {
    arm64: 'OpenJDK17U-jre_aarch64_mac_hotspot_17.0.16_8.tar.gz',
    x64: 'OpenJDK17U-jre_x64_mac_hotspot_17.0.16_8.tar.gz',
  },
  linux: {
    arm64: 'OpenJDK17U-jre_aarch64_linux_hotspot_17.0.16_8.tar.gz',
    x64: 'OpenJDK17U-jre_x64_linux_hotspot_17.0.16_8.tar.gz',
  },
};

export function checkJreExists() {
  const javaPath = getJavaPath();
  return !!javaPath && fs.existsSync(javaPath);
}

/** Download the JRE for this platform and unpack it into the simulator data directory. */
export async function downloadJre(step: DownloadStep) {
  const archive = JRE_ARCHIVES[process.platform]?.[process.arch];
  if (!archive) {
    throw new Error(`Unsupported architecture: ${process.arch} for platform: ${process.platform}`);
  }
  const archiveName = process.platform === 'win32' ? 'jre.zip' : 'jre.tar.gz';
  console.log(`Downloading the JRE (${process.platform}, ${process.arch})`);
  await downloadFile(archiveName, `${TEMURIN_RELEASE}/${archive}`, step);

  console.log('Unpacking the JRE');
  const dataDir = getSimulatorDataDir();
  const archivePath = path.join(dataDir, archiveName);
  fs.mkdirSync(dataDir, { recursive: true });
  if (process.platform === 'win32') {
    extractWindowsZip(archivePath, dataDir);
  } else {
    // pipeline also rejects when the archive cannot be read.
    await pipeline(fs.createReadStream(archivePath), tar.extract({ cwd: dataDir }));
  }
  fs.unlinkSync(archivePath);
  console.log('JRE unzip complete');
}

/**
 * Windows: unpack the ZIP and rename its top folder (jdk-…-jre) to `jre`, where
 * getJavaPath() looks for java.exe.
 */
function extractWindowsZip(zipPath: string, dataDir: string) {
  const tempDir = path.join(dataDir, 'temp_extract');
  fs.mkdirSync(tempDir, { recursive: true });
  new AdmZip(zipPath).extractAllTo(tempDir, true);

  const jreDir = fs.readdirSync(tempDir).find(name => name.includes('jdk') || name.includes('jre'));
  if (jreDir) {
    const target = path.join(dataDir, 'jre');
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(path.join(tempDir, jreDir), target);
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
}
