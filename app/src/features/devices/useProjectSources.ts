import { useEffect, useState } from 'react';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import {
  devicesInSources,
  sectionsInSource,
  type SourceDevice,
} from '@/features/devices/sourceDevices';
import { useProjectStore } from '@/features/project/projectStore';
import { resolveInProject } from '@/lib/projectPath';

/** How long typing pauses before the sources are read again. */
const DEBOUNCE_MS = 300;

export interface ProjectSources {
  /** The devices the program uses (RD/WD/TD). */
  devices: SourceDevice[];
  /** The control sections each assembled file defines (START, CSECT), by file. */
  sections: Record<string, string[]>;
}

/**
 * What the project's assembled files hold, read from their source: an open file's text as it
 * is in the editor (also unsaved), the others from the disk.
 */
export function useProjectSources(): ProjectSources {
  const projectPath = useProjectStore(s => s.projectPath);
  const asm = useProjectStore(s => s.settings.asm);
  const tabs = useEditorTabStore(s => s.tabs);
  const [found, setFound] = useState<ProjectSources>({ devices: [], sections: {} });

  const openTexts = tabs.filter(tab => asm.includes(tab.filePath));
  const key = `${projectPath}|${asm.join('\n')}|${openTexts.map(t => `${t.filePath}:${t.content}`).join('\n')}`;

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      void Promise.all(
        asm.map(async file => {
          const open = useEditorTabStore.getState().tabs.find(tab => tab.filePath === file);
          if (open) return open.content;
          const res = await window.api.readFile(resolveInProject(projectPath, file));
          return res.success && typeof res.data === 'string' ? res.data : '';
        }),
      ).then(texts => {
        if (!current) return;
        setFound({
          devices: devicesInSources(texts),
          sections: Object.fromEntries(asm.map((file, i) => [file, sectionsInSource(texts[i])])),
        });
      });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // `key` stands for the project, its asm list and the open files' text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return found;
}

/**
 * The file of the program that runs first, as the simulator picks it: the only assembled
 * file; else the one defining the section project.sic's main names (matched exactly, as the
 * linker does; a file named like it while the sources are being read); with no main, the
 * first file. Null if no file defines it (the link then fails).
 */
export function mainFileOf(
  asm: string[],
  main: string,
  sections: Record<string, string[]>,
): string | null {
  if (asm.length <= 1) return asm[0] ?? null;
  if (!main.trim()) return asm[0];
  const bySection = asm.find(file => sections[file]?.includes(main));
  if (bySection) return bySection;
  const unread = asm.filter(file => !(file in sections));
  return (
    unread.find(
      file =>
        file
          .split('/')
          .pop()!
          .replace(/\.asm$/i, '') === main,
    ) ?? null
  );
}

/** The main program's file (see mainFileOf). */
export function useMainFile(sources: ProjectSources): string | null {
  const asm = useProjectStore(s => s.settings.asm);
  const main = useProjectStore(s => s.settings.main);
  return mainFileOf(asm, main, sources.sections);
}
