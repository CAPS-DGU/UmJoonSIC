import { useEffect } from 'react';
import { AppEvent } from '@shared/ipc';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { requestCloseTab, resolveUnsavedChanges } from '@/features/editor/unsavedChanges';

/**
 * Closing from outside the page: the window (close button, Alt+F4, quit), which the main
 * process holds back while there are unsaved changes, and File > Close Tab (Ctrl+W).
 */
export function useCloseRequests() {
  const hasUnsavedChanges = useEditorTabStore(state => state.tabs.some(tab => tab.isModified));

  // The main process only asks when there is something to lose.
  useEffect(() => {
    window.api.setHasUnsavedChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const onCloseWindow = async () => {
      if (await resolveUnsavedChanges()) {
        await window.api.closeWindow();
      }
    };
    const onCloseTab = () => {
      const { activePath } = useEditorTabStore.getState();
      if (activePath) void requestCloseTab(activePath);
    };
    window.addEventListener(AppEvent.closeRequested, onCloseWindow);
    window.addEventListener(AppEvent.closeActiveTab, onCloseTab);
    return () => {
      window.removeEventListener(AppEvent.closeRequested, onCloseWindow);
      window.removeEventListener(AppEvent.closeActiveTab, onCloseTab);
    };
  }, []);
}
