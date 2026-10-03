// Check GitHub for a newer app release and offer to open the download page.
import { app, dialog, shell } from 'electron';

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
