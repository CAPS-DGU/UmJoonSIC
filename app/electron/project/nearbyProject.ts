// The project an assembly file opened from outside the app belongs to (double-click,
// "Open with", the command line): the nearest project.sic in its folder or a folder above,
// as IntelliJ finds a file's project by the nearest .idea above it.
import fs from 'fs';
import path from 'path';

/** How many folders above the file's own are searched (projects keep modules in lib/ …). */
const PARENT_LEVELS = 3;

/** The nearest project.sic to `filePath`: in its folder or up to three folders above. */
export function nearbyProject(filePath: string): string | null {
  let dir = path.dirname(path.resolve(filePath));
  for (let level = 0; level <= PARENT_LEVELS; level++) {
    const sic = path.join(dir, 'project.sic');
    if (fs.existsSync(sic) && fs.statSync(sic).isFile()) return sic;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
