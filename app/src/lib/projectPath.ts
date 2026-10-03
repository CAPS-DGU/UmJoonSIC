/**
 * The path of `filePath` relative to the project folder, with '/' separators.
 * A path outside the project is returned as it is.
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
