/**
 * 프로젝트 기준 상대경로로 변환
 * @param projectPath 프로젝트 루트 절대경로
 * @param filePath 변환할 파일 절대경로
 */
export function toProjectRelativePath(projectPath: string, filePath: string): string {
  if (!filePath.startsWith(projectPath)) {
    return filePath;
  }
  let relative = filePath.slice(projectPath.length);
  if (relative.startsWith('/') || relative.startsWith('\\')) {
    relative = relative.slice(1);
  }
  return relative.replace(/\\/g, '/');
}
