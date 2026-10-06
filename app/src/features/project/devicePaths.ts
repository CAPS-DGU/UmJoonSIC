import { folderOf, isForeignPath } from '@/lib/projectPath';

/**
 * Which device files can be used on this computer: the file exists, or it does not exist yet
 * but its folder does (the simulator creates an output file). A path from another kind of
 * system, or one whose folder is missing, cannot be used: the simulator would create a file
 * named like it somewhere else (usage study, 2026-10-06). `paths` are full paths.
 */
export async function usableDevicePaths(projectPath: string, paths: string[]): Promise<boolean[]> {
  const res = await window.api.pathExists([...paths, ...paths.map(folderOf)]);
  // Without an answer, do not stop the user.
  if (!res.success || !res.data) return paths.map(() => true);
  const exists = res.data;
  return paths.map(
    (p, i) => exists[i] || (!isForeignPath(projectPath, p) && exists[paths.length + i]),
  );
}
