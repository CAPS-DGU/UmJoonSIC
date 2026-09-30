import { useEffect, useRef } from 'react';
import { AppEvent } from '@shared/ipc';
import { useProjectStore } from '@/features/project/projectStore';

/** How often, and how many times, to ask the preload script for a project path queued at startup. */
const QUEUE_POLL_MS = 250;
const QUEUE_POLL_ATTEMPTS = 20;

/** Run `handler` whenever the DOM event `name` fires on window. */
function useWindowEvent(name: string, handler: (event: Event) => void) {
  useEffect(() => {
    window.addEventListener(name, handler);
    return () => window.removeEventListener(name, handler);
  }, [name, handler]);
}

/**
 * Connect the project commands to the store: the File menu (relayed by the preload
 * script as DOM events), the welcome screen's buttons, and project.sic paths that
 * arrive from outside the app (file association, second instance).
 */
export function useProjectEvents() {
  const createNewProject = useProjectStore(s => s.createNewProject);
  const openProject = useProjectStore(s => s.openProject);
  const openProjectByPath = useProjectStore(s => s.openProjectByPath);
  const closeProject = useProjectStore(s => s.closeProject);
  const projectName = useProjectStore(s => s.projectName);

  useWindowEvent(AppEvent.createNewProject, createNewProject);
  useWindowEvent(AppEvent.openProject, openProject);
  useWindowEvent(AppEvent.closeProject, closeProject);

  // The same path can arrive twice (as an event and from the startup queue); open it once.
  const lastOpenedPathRef = useRef<string | null>(null);

  useEffect(() => {
    /** Returns false when `sicPath` is the project that was opened last. */
    const openOnce = (sicPath: string) => {
      if (lastOpenedPathRef.current === sicPath) return false;
      lastOpenedPathRef.current = sicPath;
      openProjectByPath(sicPath);
      return true;
    };

    const handleOpenProjectPath = (event: Event) => {
      const sicPath = (event as CustomEvent<string>).detail;
      if (typeof sicPath === 'string' && sicPath.length > 0) {
        openOnce(sicPath);
      }
    };
    window.addEventListener(AppEvent.openProjectPath, handleOpenProjectPath);

    // A path sent before this listener existed waits in the preload script.
    let retryHandle: number | null = null;
    let attempts = 0;
    const pollQueuedPath = () => {
      retryHandle = null;
      const queuedPath = window.api.consumeQueuedProjectPath?.();
      if (typeof queuedPath === 'string' && queuedPath.length > 0) {
        openOnce(queuedPath);
        return;
      }
      attempts += 1;
      if (attempts < QUEUE_POLL_ATTEMPTS) {
        retryHandle = window.setTimeout(pollQueuedPath, QUEUE_POLL_MS);
      }
    };
    retryHandle = window.setTimeout(pollQueuedPath, 0);

    return () => {
      window.removeEventListener(AppEvent.openProjectPath, handleOpenProjectPath);
      if (retryHandle !== null) {
        window.clearTimeout(retryHandle);
      }
    };
  }, [openProjectByPath]);

  // Closing the project allows the same path to be opened again.
  useEffect(() => {
    if (!projectName) {
      lastOpenedPathRef.current = null;
    }
  }, [projectName]);
}
