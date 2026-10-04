import { simulator } from '@/api/simulator';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { useErrorStore } from '@/features/panel/errorStore';
import { useProjectStore } from '@/features/project/projectStore';

/** Typing pauses this long before the syntax is checked. */
const TYPING_PAUSE_MS = 1000;

/** Only files listed in project.sic are checked and auto-indented; .txt, .obj and the like are left alone. */
export function isProjectAsmFile(filePath?: string) {
  if (!filePath) return false;
  const { settings } = useProjectStore.getState();
  return Array.isArray(settings?.asm) && settings.asm.includes(filePath);
}

/**
 * Assemble the given texts on the simulator (nothing is loaded) and publish each file's
 * syntax errors, replacing the ones it had.
 */
export async function checkSyntax(texts: string[], fileNames: string[]) {
  if (!texts?.length || !fileNames?.length || texts.length !== fileNames.length) return;
  fileNames.forEach(cancelScheduledCheck);
  try {
    const data = await simulator.syntaxCheck(texts, fileNames);
    fileNames.forEach((fileName, idx) => {
      useErrorStore
        .getState()
        .setErrors(fileName, 'syntax', data.files[idx]?.assemblerErrors ?? []);
    });
  } catch (error) {
    console.error('Syntax check failed:', error);
  }
}

/** Pending checks of edited files, one per file. */
const scheduledChecks = new Map<string, ReturnType<typeof setTimeout>>();

/** Check a file once typing has paused. A newer edit of the same file replaces the request. */
export function scheduleSyntaxCheck(filePath: string, text: string) {
  cancelScheduledCheck(filePath);
  scheduledChecks.set(
    filePath,
    setTimeout(() => {
      scheduledChecks.delete(filePath);
      checkSyntax([text], [filePath]);
    }, TYPING_PAUSE_MS),
  );
}

/** Drop a file's pending check (the file was checked, closed or its edit discarded). */
export function cancelScheduledCheck(filePath: string) {
  const timer = scheduledChecks.get(filePath);
  if (timer !== undefined) {
    clearTimeout(timer);
    scheduledChecks.delete(filePath);
  }
}

/** Drop every pending check (another project is opened). */
export function cancelAllScheduledChecks() {
  scheduledChecks.forEach(timer => clearTimeout(timer));
  scheduledChecks.clear();
}

/** Check every open project file again, for example after the machine mode has changed. */
export function recheckOpenProjectFiles() {
  const tabs = useEditorTabStore.getState().tabs.filter(tab => isProjectAsmFile(tab.filePath));
  if (tabs.length === 0) return;
  checkSyntax(
    tabs.map(tab => tab.content),
    tabs.map(tab => tab.filePath),
  );
}
