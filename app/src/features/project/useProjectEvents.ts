import { useEffect } from 'react';
import { AppEvent } from '@shared/ipc';
import { openFromOutside } from '@/features/project/outsideFiles';
import { useProjectStore } from '@/features/project/projectStore';

/** Run `handler` whenever the DOM event `name` fires on window. */
function useWindowEvent(name: string, handler: (event: Event) => void) {
  useEffect(() => {
    window.addEventListener(name, handler);
    return () => window.removeEventListener(name, handler);
  }, [name, handler]);
}

/**
 * Connect the project commands to the store: the File menu (relayed by the preload
 * script as DOM events), the welcome screen's buttons, and project.sic or assembly files
 * that arrive from outside the app (file association, second instance; outsideFiles.ts).
 */
export function useProjectEvents() {
  const createNewProject = useProjectStore(s => s.createNewProject);
  const openProject = useProjectStore(s => s.openProject);
  const closeProject = useProjectStore(s => s.closeProject);

  useWindowEvent(AppEvent.createNewProject, createNewProject);
  useWindowEvent(AppEvent.openProject, openProject);
  useWindowEvent(AppEvent.closeProject, closeProject);

  // A project.sic or an assembly file from outside the app waits in the preload script;
  // whoever takes it from there opens it, so each is opened once. One may have arrived before
  // this listener existed, hence the first look.
  useEffect(() => {
    const openQueued = () => {
      const request = window.api.consumeQueuedOpenRequest();
      if (request) void openFromOutside(request);
    };
    window.addEventListener(AppEvent.openRequest, openQueued);
    openQueued();
    return () => window.removeEventListener(AppEvent.openRequest, openQueued);
  }, []);
}
