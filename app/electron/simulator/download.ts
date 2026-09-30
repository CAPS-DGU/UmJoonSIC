// Download a file into the simulator data directory, showing a progress window.
import path from 'path';
import fs from 'fs';
import { BrowserWindow } from 'electron';
import { rendererFile } from '../paths';
import { getSimulatorDataDir } from './paths';

export async function downloadFile(relativePath: string, url: string) {
  const filePath = path.join(getSimulatorDataDir(), relativePath);

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
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  // 프로그레스 다이얼로그 HTML 로드
  const progressHtmlPath = rendererFile('progress.html');
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
