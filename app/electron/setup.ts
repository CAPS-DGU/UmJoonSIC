import path from 'path';
import fs from 'fs';
import { createReadStream } from 'fs';
import { app, BrowserWindow } from 'electron';
import * as tar from 'tar';
import * as AdmZip from 'adm-zip';

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

export function checkServerExists() {
  const serverPath = path.join(app.getPath('appData'), 'umjoonsic', 'simulator.jar');
  const hasServer = fs.existsSync(serverPath);
  if (!hasServer) {
    return false;
  } else {
    return true;
  }
}

export async function downloadFile(relativePath: string, url: string) {
  const filePath = path.join(app.getPath('appData'), 'umjoonsic', relativePath);

  // 프로그레스 다이얼로그 생성
  const progressWindow = new BrowserWindow({
    title: `Downloading ${relativePath}`,
    width: 400,
    height: 200,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    modal: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  // 프로그레스 다이얼로그 HTML 로드
  const progressHtmlPath = path.join(__dirname, '../renderer/progress.html');
  progressWindow.loadFile(progressHtmlPath);

  // 창 로드 완료 대기 후 표시
  await new Promise<void>(resolve => {
    progressWindow.webContents.once('did-finish-load', resolve);
  });

  console.log('HTML 로드 완료');

  // JavaScript 실행 완료 대기 (안전하게)
  await new Promise<void>(resolve => {
    setTimeout(resolve, 200); // 충분한 시간 대기
  });

  console.log('JavaScript 준비 완료');

  if (!progressWindow.isDestroyed()) {
    progressWindow.show();
    console.log('프로그레스 창 표시됨');
  }

  // 창 상태 추적 및 업데이트 가능 여부 헬퍼
  let isClosed = false;
  progressWindow.on('closed', () => {
    isClosed = true;
  });
  const canUpdate = () =>
    !isClosed && !progressWindow.isDestroyed() && !progressWindow.webContents.isDestroyed();

  try {
    // Content-Length 헤더를 가져오기 위해 HEAD 요청
    const headResponse = await fetch(url, { method: 'HEAD' });
    const totalSize = parseInt(headResponse.headers.get('content-length') || '0');

    // 실제 다운로드 시작
    const response = await fetch(url);

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let downloadedSize = 0;
    let lastUpdateAt = 0;
    let lastPercent = -1;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      downloadedSize += value.length;

      // 프로그레스 업데이트 (스로틀 + 창 상태 체크)
      const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
      const status = `다운로드 중... ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB)`;

      const now = Date.now();
      if (canUpdate() && (percent !== lastPercent || now - lastUpdateAt > 150)) {
        lastPercent = percent;
        lastUpdateAt = now;
        try {
          // 더 안전한 JavaScript 실행
          const safeStatus = status.replace(/['"\\]/g, '\\$&');
          const jsCode = `
            if (typeof window.updateProgress === 'function') {
              window.updateProgress(${percent}, '${safeStatus}');
            }
          `;
          await progressWindow.webContents.executeJavaScript(jsCode);
        } catch (error) {
          console.warn('Progress update failed:', error);
        }
      }
    }

    // 파일 저장
    try {
      if (canUpdate()) {
        await progressWindow.webContents.executeJavaScript(`
          if (typeof window.updateProgress === 'function') {
            window.updateProgress(100, '파일을 저장하는 중...');
          }
        `);
      }
    } catch (error) {
      console.warn('Progress update failed:', error);
    }

    const data = new Uint8Array(downloadedSize);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }

    fs.writeFileSync(filePath, Buffer.from(data));

    // 완료 메시지
    try {
      if (canUpdate()) {
        await progressWindow.webContents.executeJavaScript(`
          if (typeof window.updateProgress === 'function') {
            window.updateProgress(100, '다운로드 완료!');
          }
        `);
      }
    } catch (error) {
      console.warn('Progress update failed:', error);
    }

    // 1초 후 창 닫기
    setTimeout(() => {
      progressWindow.close();
    }, 1000);
  } catch (error) {
    console.error('Download failed:', error);
    try {
      if (canUpdate()) {
        const errorMsg = (error as Error)?.message || '알 수 없는 오류';
        const safeMsg = errorMsg.replace(/['"\\]/g, '\\$&');
        await progressWindow.webContents.executeJavaScript(`
          if (typeof window.updateProgress === 'function') {
            window.updateProgress(0, '다운로드 실패: ${safeMsg}');
          }
        `);
      }
    } catch (updateError) {
      console.warn('Error update failed:', updateError);
    }

    // 3초 후 창 닫기
    setTimeout(() => {
      progressWindow.close();
    }, 3000);
  }
}

export async function downloadJre() {
  const jreUrl = {
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
  const jreExtractPath = path.join(app.getPath('appData'), 'umjoonsic');

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
  const fullArchivePath = path.join(app.getPath('appData'), 'umjoonsic', jreArchivePath);
  await extractJre(fullArchivePath, jreExtractPath);
}

export async function downloadServer() {
  const serverPath = 'simulator.jar';
  const serverUrl = 'https://github.com/CAPS-DGU/UmJoonSIC/releases/download/v0.0.1/simulator.jar';

  console.log('server 다운로드');
  return downloadFile(serverPath, serverUrl);
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
  return new Promise((resolve, reject) => {
    const readStream = createReadStream(tarGzPath);

    readStream
      .pipe(tar.extract({ cwd: extractPath }))
      .on('end', () => {
        resolve();
      })
      .on('error', reject);
  });
}

/**
 * 플랫폼에 따른 압축 해제 함수
 */
async function extractJre(archivePath: string, extractPath: string): Promise<void> {
  console.log(`JRE 압축 해제 중: ${archivePath} -> ${extractPath}`);

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
  console.log('JRE 압축 해제 완료');
}

export function getJavaPath() {
  const appDataPath = path.join(app.getPath('appData'), 'umjoonsic');
  if (process.platform === 'win32') {
    return path.join(appDataPath, 'jdk-17.0.16+8-jre', 'bin', 'java.exe');
  } else if (process.platform === 'darwin') {
    return path.join(appDataPath, 'jdk-17.0.16+8-jre', 'Contents', 'Home', 'bin', 'java');
  } else if (process.platform === 'linux') {
    return path.join(appDataPath, 'jdk-17.0.16+8-jre', 'bin', 'java');
  }
  return null;
}

export function getServerPath() {
  const appDataPath = path.join(app.getPath('appData'), 'umjoonsic');
  return path.join(appDataPath, 'simulator.jar');
}

export async function initServer() {
  const res = await fetch('http://localhost:8080/begin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error('Failed to initialize server');
  }

  const data = await res.json();
  console.log('Server initialized:', data.message);
}
