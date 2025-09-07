export function normalize(p: string) {
  return p.replace(/\\/g, '/'); // 윈도우 → POSIX
}

// 파일명이 붙어있든, 폴더든 상관없이 부모 폴더 경로만 반환
// "a/b/c.txt" → "a/b"
// "a/b"       → "a"
// "c.txt"     → ""
// ""          → ""
export function dirname(p: string) {
  const n = normalize(p).replace(/\/+$/, ''); // 끝 슬래시 제거
  const i = n.lastIndexOf('/');
  return i === -1 ? '' : n.slice(0, i);
}

// 안전 조인 (중복 슬래시 제거)
export function join(...parts: (string | undefined | null)[]) {
  return normalize(parts.filter(Boolean).join('/')).replace(/\/+/g, '/');
}
