/**
 * The path of `filePath` relative to the project folder, with '/' separators.
 * A path outside the project is returned as it is.
 */
export function toProjectRelativePath(projectPath: string, filePath: string): string {
  const rest = filePath.slice(projectPath.length);
  // Inside the project only if a separator (or nothing) follows the project folder:
  // /home/u/proj2/x.asm is not in /home/u/proj.
  if (!filePath.startsWith(projectPath) || (rest !== '' && !/^[/\\]/.test(rest))) {
    return filePath;
  }
  return rest.replace(/^[/\\]/, '').replace(/\\/g, '/');
}

/**
 * Absolute on any system: /x, C:\x or C:/x, \\server\share. The renderer's `path` module
 * (path-browserify) knows only '/' paths, so it took C:\… for a relative path.
 */
export function isAbsolutePath(filePath: string): boolean {
  return /^([/\\]|[A-Za-z]:[/\\])/.test(filePath);
}

/**
 * A path from project.sic as a full path: a relative one is inside the project folder,
 * with the project folder's separator (a Windows folder gets '\').
 */
export function resolveInProject(projectPath: string, filePath: string): string {
  if (isAbsolutePath(filePath)) return filePath;
  const sep = projectPath.includes('\\') && !projectPath.includes('/') ? '\\' : '/';
  const rest = filePath.replace(/^\.[/\\]/, '').replace(/[/\\]/g, sep);
  return projectPath.replace(/[/\\]+$/, '') + sep + rest;
}

/** C:\… or \\server\…: a Windows path. */
const WINDOWS_PATH = /^([A-Za-z]:[/\\]|\\\\)/;

/**
 * A path written on another kind of system: C:\… while the project is on Linux or macOS, or
 * /… while it is on Windows (a project.sic handed in from another computer).
 */
export function isForeignPath(projectPath: string, filePath: string): boolean {
  return WINDOWS_PATH.test(projectPath) ? filePath.startsWith('/') : WINDOWS_PATH.test(filePath);
}

/** The folder a path is in (with either separator); '' for a bare name. */
export function folderOf(filePath: string): string {
  const i = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (i < 0) return '';
  return i === 0 || /^[A-Za-z]:$/.test(filePath.slice(0, i))
    ? filePath.slice(0, i + 1)
    : filePath.slice(0, i);
}
