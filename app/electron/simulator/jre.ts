// The bundled-on-demand Java runtime: presence check, download, extraction.
import path from 'path';
import fs from 'fs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import AdmZip from 'adm-zip';
import { downloadFile } from './download';
import { getJavaPath, getSimulatorDataDir } from './paths';

export function checkJreExists() {
  const jrePath = getJavaPath();
  if (!jrePath) {
    return false;
  }
  const hasJre = fs.existsSync(jrePath);
  if (!hasJre) {
    return false;
  }
  return true;
}

export async function downloadJre() {
  const jreUrl: Partial<Record<NodeJS.Platform, Partial<Record<string, string>>>> = {
    win32: {
      x64: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.16%2B8/OpenJDK17U-jre_x64_windows_hotspot_17.0.16_8.zip',
    },
    darwin: {
      arm64:
        'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.16%2B8/OpenJDK17U-jre_aarch64_mac_hotspot_17.0.16_8.tar.gz',
      x64: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.16%2B8/OpenJDK17U-jre_x64_mac_hotspot_17.0.16_8.tar.gz',
    },
    linux: {
      arm64:
        'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.16%2B8/OpenJDK17U-jre_aarch64_linux_hotspot_17.0.16_8.tar.gz',
      x64: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.16%2B8/OpenJDK17U-jre_x64_linux_hotspot_17.0.16_8.tar.gz',
    },
  };

  const jreArchivePath = process.platform === 'win32' ? 'jre.zip' : 'jre.tar.gz';
  const jreExtractPath = getSimulatorDataDir();

  // 아키텍처 확인
  const arch = process.arch;
  console.log(`Platform: ${process.platform}, Architecture: ${arch}`);

  // URL 가져오기
  const url = jreUrl[process.platform]?.[arch];
  if (!url) {
    throw new Error(`Unsupported architecture: ${arch} for platform: ${process.platform}`);
  }

  console.log('JRE 다운로드 시작');
  await downloadFile(jreArchivePath, url);

  console.log('JRE 압축 해제 시작');
  const fullArchivePath = path.join(getSimulatorDataDir(), jreArchivePath);
  await extractJre(fullArchivePath, jreExtractPath);
}

/**
 * ZIP 파일 압축 해제
 */
async function extractZip(zipPath: string, extractPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip(zipPath);

      // 임시 디렉토리에 압축 해제
      const tempExtractPath = path.join(extractPath, 'temp_extract');
      if (!fs.existsSync(tempExtractPath)) {
        fs.mkdirSync(tempExtractPath, { recursive: true });
      }

      zip.extractAllTo(tempExtractPath, true);

      // JRE 폴더 찾기 및 이동
      const extractedDirs = fs.readdirSync(tempExtractPath);
      const jreDir = extractedDirs.find(
        dir =>
          dir.startsWith('jdk') ||
          dir.startsWith('jre') ||
          dir.includes('jdk') ||
          dir.includes('jre'),
      );

      if (jreDir) {
        const sourcePath = path.join(tempExtractPath, jreDir);
        const targetPath = path.join(extractPath, 'jre');
        console.log(`Moving JRE from ${sourcePath} to ${targetPath}`);

        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }

        fs.renameSync(sourcePath, targetPath);
      }

      // 임시 파일 정리
      fs.rmSync(tempExtractPath, { recursive: true, force: true });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * TAR.GZ 파일 압축 해제
 */
async function extractTarGz(tarGzPath: string, extractPath: string): Promise<void> {
  // pipeline also rejects when the archive cannot be read (a missing file used to hang here).
  await pipeline(createReadStream(tarGzPath), tar.extract({ cwd: extractPath }));
}

/**
 * 플랫폼에 따른 압축 해제 함수
 */
async function extractJre(archivePath: string, extractPath: string): Promise<void> {
  console.log(`JRE unziping: ${archivePath} -> ${extractPath}`);

  // 압축 해제 디렉토리 생성
  if (!fs.existsSync(extractPath)) {
    fs.mkdirSync(extractPath, { recursive: true });
  }

  if (process.platform === 'win32') {
    // Windows: ZIP 파일
    await extractZip(archivePath, extractPath);
  } else {
    // macOS/Linux: TAR.GZ 파일
    await extractTarGz(archivePath, extractPath);
  }

  // 압축 파일 삭제
  fs.unlinkSync(archivePath);
  console.log('JRE unzip complete');
}
