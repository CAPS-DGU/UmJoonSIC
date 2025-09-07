import path from 'path';
import fs from 'fs';
import { createReadStream } from 'fs';
import { app, BrowserWindow, dialog, shell } from 'electron';
import * as tar from 'tar';
import AdmZip from 'adm-zip';
import { ChildProcess, spawn } from 'child_process';
import { createHash } from 'crypto';

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
  const urlFromRelease = await getAssetUrlFromCurrentTag('simulator.jar');
  const fallbackUrl = `https://github.com/CAPS-DGU/UmJoonSIC/releases/download/v${app.getVersion()}/simulator.jar`;
  const serverUrl = urlFromRelease || fallbackUrl;

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

export const jdkFullName = 'jdk-17.0.16+8-jre';

export function getJavaPath() {
  const appDataPath = path.join(app.getPath('appData'), 'umjoonsic');
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
  const appDataPath = path.join(app.getPath('appData'), 'umjoonsic');
  return path.join(appDataPath, 'simulator.jar');
}

export async function initServer() {
  const res = await fetch('http://localhost:9090/begin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'sic',
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to initialize server');
  }

  const data = await res.json();
  console.log('Server initialized:', data.message);
}

export async function runServer(): Promise<ChildProcess> {
  const javaPath = getJavaPath();
  if (!javaPath) {
    console.error('Java 경로를 찾을 수 없습니다.');
    app.quit();
    throw new Error('Java path not found');
  }

  const serverProcess = spawn(javaPath, ['-jar', getServerPath(), '9090']);

  if (serverProcess && serverProcess.stdout && serverProcess.stderr) {
    const { BrowserWindow } = require('electron');
    const broadcast = (type: 'out' | 'error', message: string) => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        try {
          win.webContents.send('server-log', { type, message });
        } catch {}
      }
    };

    serverProcess.stdout.on('data', data => {
      const text = String(data);
      console.log(text);
      broadcast('out', text);
    });
    serverProcess.stderr.on('data', data => {
      const text = String(data);
      console.error(text);
      broadcast('error', text);
    });
    serverProcess.on('close', code => {
      const msg = `서버 종료: ${code}`;
      console.log(msg);
      broadcast('out', msg);
    });
  }
  setTimeout(() => {
    initServer().catch(error => {
      console.error('Server 초기화 실패:', error);
      if (serverProcess) {
        serverProcess.kill();
      }
      app.quit();
    });
  }, 1000);
  return serverProcess;
}

export async function checkUpdate() {
  try {
    const currentVersion = app.getVersion();
    const res = await fetch('https://api.github.com/repos/CAPS-DGU/UmJoonSIC/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      console.warn('Failed to fetch latest release:', res.status);
      return;
    }
    const data = (await res.json()) as {
      tag_name?: string;
      name?: string;
      html_url?: string;
    };

    const latestTag = (data.tag_name || data.name || '').replace(/^v/i, '');
    const latestUrl = data.html_url || 'https://github.com/CAPS-DGU/UmJoonSIC/releases/latest';

    const cmp = (a: string, b: string) => {
      const pa = a.split('.').map(n => parseInt(n, 10) || 0);
      const pb = b.split('.').map(n => parseInt(n, 10) || 0);
      const len = Math.max(pa.length, pb.length);
      for (let i = 0; i < len; i++) {
        const da = pa[i] ?? 0;
        const db = pb[i] ?? 0;
        if (da > db) return 1;
        if (da < db) return -1;
      }
      return 0;
    };

    if (latestTag && cmp(latestTag, currentVersion) > 0) {
      const result = await dialog.showMessageBox({
        type: 'question',
        title: '업데이트 확인',
        message: `새로운 버전이 있습니다.\n현재: ${currentVersion} → 최신: ${latestTag}\n지금 다운로드 페이지로 이동하시겠습니까?`,
        buttons: ['예', '아니요'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      if (result.response === 0) {
        await shell.openExternal(latestUrl);
        app.quit();
      }
    }
  } catch (e) {
    console.warn('checkUpdate failed:', e);
  }
}
  
export async function checkJARUpdate() {
  try {
    // 네트워크/릴리즈 정보 조회 시도
    const assets = await resolveJarAndHashFromReleases();

    // 네트워크 접근 불가 또는 API 실패의 명확한 신호로 null 반환
    if (assets === null) {
      const exists = fs.existsSync(getServerPath());
      if (exists) {
        // 조용히 통과 (요구사항)
        return;
      } else {
        // 오류 안내 후 종료 (요구사항)
        dialog.showErrorBox(
          '네트워크 오류',
          '서버에 연결할 수 없고 simulator.jar 파일이 없습니다. 애플리케이션을 종료합니다.',
        );
        app.quit();
        return;
      }
    }

    const { jarUrl, hashUrl } = assets;

    const localJarPath = getServerPath();
    const hasLocal = fs.existsSync(localJarPath);

    // 원격 해시 가져오기
    const res = await fetch(hashUrl, { headers: { Accept: 'text/plain' } });
    if (!res.ok) {
      console.warn('원격 해시 파일을 가져오지 못했습니다:', res.status);
      // 해시 비교가 불가하면, 로컬이 없으면 다운로드, 있으면 유지
      if (!hasLocal) {
        await downloadFile('simulator.jar', jarUrl);
      }
      return;
    }

    const text = (await res.text()).trim();
    const remoteHash = (text.split(/\s+/)[0] || '').toLowerCase();

    if (!hasLocal) {
      // 로컬이 없으면 곧바로 다운로드
      await downloadFile('simulator.jar', jarUrl);
      return;
    }

    const localHash = await computeFileSha256(localJarPath);
    if (localHash.toLowerCase() !== remoteHash) {
      await downloadFile('simulator.jar', jarUrl);
    }
  } catch (e) {
    console.warn('checkJARUpdate 실패:', e);
    const exists = fs.existsSync(getServerPath());
    if (!exists) {
      dialog.showErrorBox(
        '오류',
        '예기치 못한 오류로 simulator.jar을 준비하지 못했습니다. 애플리케이션을 종료합니다.',
      );
      app.quit();
    }
  }
}

// 현재 앱 버전 태그 우선, 없으면 latest에서 simulator.jar / simulator-hash.txt 페어를 해석
async function resolveJarAndHashFromReleases(): Promise<{ jarUrl: string; hashUrl: string } | null> {
  try {
    const currentTag = `v${app.getVersion()}`;

    // 1) 현재 태그의 릴리즈 조회
    const tagAssets = await fetchReleaseAssetsByTag(currentTag);
    if (tagAssets) {
      const pair = pickJarAndHash(tagAssets);
      if (pair) return pair;
    }

    // 2) latest 릴리즈 조회 (태그에 없거나 에셋 불충분 시)
    const latestAssets = await fetchLatestReleaseAssets();
    if (latestAssets) {
      const pair = pickJarAndHash(latestAssets);
      if (pair) return pair;
    }

    // 네트워크 연결은 되었으나 필요한 에셋이 모두 없는 경우
    console.warn('릴리즈에서 simulator.jar 또는 simulator-hash.txt를 찾지 못했습니다.');
    return { jarUrl: '', hashUrl: '' };
  } catch (e) {
    // 네트워크 불가 등 치명적 오류 -> null 반환하여 상위에서 오프라인 분기 처리
    return null;
  }
}

type ReleaseAsset = { name?: string; browser_download_url?: string };

async function fetchReleaseAssetsByTag(tag: string): Promise<ReleaseAsset[] | null> {
  const url = `https://api.github.com/repos/CAPS-DGU/UmJoonSIC/releases/tags/${encodeURIComponent(tag)}`;
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const data = (await res.json()) as { assets?: ReleaseAsset[] };
  return data.assets ?? [];
}

async function fetchLatestReleaseAssets(): Promise<ReleaseAsset[] | null> {
  const url = `https://api.github.com/repos/CAPS-DGU/UmJoonSIC/releases/latest`;
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const data = (await res.json()) as { assets?: ReleaseAsset[] };
  return data.assets ?? [];
}

function pickJarAndHash(assets: ReleaseAsset[]): { jarUrl: string; hashUrl: string } | null {
  const jar = assets.find(a => a.name === 'simulator.jar')?.browser_download_url;
  const hash = assets.find(a => a.name === 'simulator-hash.txt')?.browser_download_url;
  if (jar && hash) return { jarUrl: jar, hashUrl: hash };
  return null;
}

async function getAssetUrlFromCurrentTag(assetName: string): Promise<string | null> {
  const tag = `v${app.getVersion()}`;
  try {
    const res = await fetch(
      `https://api.github.com/repos/CAPS-DGU/UmJoonSIC/releases/tags/${encodeURIComponent(tag)}`,
      {
        headers: { Accept: 'application/vnd.github+json' },
      },
    );
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { assets?: Array<{ name?: string; browser_download_url?: string }> };
    const asset = data.assets?.find(a => a.name === assetName);
    return asset?.browser_download_url || null;
  } catch {
    return null;
  }
}

function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
  