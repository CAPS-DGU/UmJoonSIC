// simulator.jar: presence check, download, and keeping it in sync with the GitHub release.
import fs from 'fs';
import { createReadStream } from 'fs';
import { app } from 'electron';
import { createHash } from 'crypto';
import { downloadFile } from './download';
import { getServerPath } from './paths';

export function checkServerExists() {
  return fs.existsSync(getServerPath());
}

export async function downloadServer() {
  const serverPath = 'simulator.jar';
  const urlFromRelease = await getAssetUrlFromCurrentTag('simulator.jar');
  const fallbackUrl = `https://github.com/CAPS-DGU/UmJoonSIC/releases/download/v${app.getVersion()}/simulator.jar`;
  const serverUrl = urlFromRelease || fallbackUrl;

  console.log('server 다운로드');
  return downloadFile(serverPath, serverUrl);
}

export async function checkJARUpdate() {
  try {
    // 네트워크/릴리즈 정보 조회 시도
    const assets = await resolveJarAndHashFromReleases();

    // 네트워크 접근 불가 또는 API 실패: 있는 simulator.jar 를 그대로 쓴다.
    // (없으면 시작하는 쪽에서 오류를 알리고 종료한다.)
    if (assets === null) {
      return;
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
    // 있는 simulator.jar 를 그대로 쓴다. (없으면 시작하는 쪽에서 오류를 알리고 종료한다.)
    console.warn('checkJARUpdate 실패:', e);
  }
}

// 현재 앱 버전 태그 우선, 없으면 latest에서 simulator.jar / simulator-hash.txt 페어를 해석
async function resolveJarAndHashFromReleases(): Promise<{
  jarUrl: string;
  hashUrl: string;
} | null> {
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
  } catch {
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
    const data = (await res.json()) as {
      assets?: Array<{ name?: string; browser_download_url?: string }>;
    };
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
