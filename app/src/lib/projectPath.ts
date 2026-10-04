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
