// simulator.jar: presence check, download, and keeping it equal to the one of the release.
import fs from 'fs';
import { createHash } from 'crypto';
import { app } from 'electron';
import { downloadFile } from './download';
import { getServerPath } from './paths';

const RELEASES_API = 'https://api.github.com/repos/CAPS-DGU/UmJoonSIC/releases';
const JAR_NAME = 'simulator.jar';
const HASH_NAME = 'simulator-hash.txt';

interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

/** The release of this app version (tag v<version>), or the latest one. */
const releaseUrl = (which: 'current' | 'latest') =>
  which === 'current'
    ? `${RELEASES_API}/tags/${encodeURIComponent(`v${app.getVersion()}`)}`
    : `${RELEASES_API}/latest`;

/** A release's assets; null if the release cannot be read. Network errors throw. */
async function releaseAssets(which: 'current' | 'latest'): Promise<ReleaseAsset[] | null> {
  const res = await fetch(releaseUrl(which), { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const data = (await res.json()) as { assets?: ReleaseAsset[] };
  return data.assets ?? [];
}

const assetUrl = (assets: ReleaseAsset[] | null, name: string) =>
  assets?.find(asset => asset.name === name)?.browser_download_url;

export function checkServerExists() {
  return fs.existsSync(getServerPath());
}

/** Download simulator.jar of this app version's release. */
export async function downloadServer() {
  const fromRelease = await releaseAssets('current')
    .then(assets => assetUrl(assets, JAR_NAME))
    .catch(() => undefined);
  const url =
    fromRelease ??
    `https://github.com/CAPS-DGU/UmJoonSIC/releases/download/v${app.getVersion()}/${JAR_NAME}`;
  console.log('server 다운로드');
  return downloadFile(JAR_NAME, url);
}

/**
 * Make simulator.jar equal to the release's: the release of this app version if it has
 * the JAR and its hash, otherwise the latest release. Without network, or when no release
 * has them, the JAR on disk is kept (a missing JAR is reported by the caller).
 */
export async function checkJARUpdate() {
  try {
    const release = await findReleaseJar();
    if (!release) return;

    const hasLocal = checkServerExists();
    const res = await fetch(release.hashUrl, { headers: { Accept: 'text/plain' } });
    if (!res.ok) {
      console.warn('원격 해시 파일을 가져오지 못했습니다:', res.status);
      // Without the hash, a JAR on disk is kept.
      if (!hasLocal) await downloadFile(JAR_NAME, release.jarUrl);
      return;
    }
    const remoteHash = ((await res.text()).trim().split(/\s+/)[0] ?? '').toLowerCase();
    if (!hasLocal || (await sha256(getServerPath())) !== remoteHash) {
      await downloadFile(JAR_NAME, release.jarUrl);
    }
  } catch (error) {
    console.warn('checkJARUpdate 실패:', error);
  }
}

/** The JAR and hash URLs of the release that has both; null without network or release. */
async function findReleaseJar(): Promise<{ jarUrl: string; hashUrl: string } | null> {
  for (const which of ['current', 'latest'] as const) {
    let assets: ReleaseAsset[] | null;
    try {
      assets = await releaseAssets(which);
    } catch {
      return null; // no network
    }
    const jarUrl = assetUrl(assets, JAR_NAME);
    const hashUrl = assetUrl(assets, HASH_NAME);
    if (jarUrl && hashUrl) return { jarUrl, hashUrl };
  }
  console.warn('릴리즈에서 simulator.jar 또는 simulator-hash.txt를 찾지 못했습니다.');
  return null;
}

function sha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', chunk => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex').toLowerCase()));
  });
}
