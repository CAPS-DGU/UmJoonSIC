import { simulator } from '@/api/simulator';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { useErrorStore } from '@/features/panel/errorStore';
import { useProjectStore } from '@/features/project/projectStore';

/** Only files listed in project.sic are checked and auto-indented; .txt, .obj and the like are left alone. */
export function isProjectAsmFile(filePath?: string) {
  if (!filePath) return false;
  const { settings } = useProjectStore.getState();
  return Array.isArray(settings?.asm) && settings.asm.includes(filePath);
}

/**
 * Assemble the given texts on the simulator (nothing is loaded) and publish the
 * errors of each file to the error store, replacing that file's previous errors.
 */
export async function checkSyntax(texts: string[], fileNames: string[]) {
  if (!texts?.length || !fileNames?.length || texts.length !== fileNames.length) return;
  try {
    const data = await simulator.syntaxCheck(texts, fileNames);
    fileNames.forEach((fileName, idx) => {
      const errors = data.files[idx]?.assemblerErrors ?? [];
      useErrorStore.getState().addErrors(
        fileName,
        errors.map(err => ({ ...err, type: 'syntax' as const })),
      );
    });
  } catch (error) {
    console.error('Syntax check failed:', error);
  }
}

/** Check every open project file again, for example after the machine mode has changed. */
export function recheckOpenProjectFiles() {
  const tabs = useEditorTabStore.getState().tabs.filter(tab => isProjectAsmFile(tab.filePath));
  if (tabs.length === 0) return;
  checkSyntax(
    tabs.map(tab => tab.fileContent ?? ''),
    tabs.map(tab => tab.filePath),
  );
}
