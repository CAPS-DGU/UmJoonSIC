import { useEffect } from 'react';
import { AppEvent } from '@shared/ipc';
import { useEditorTabStore } from '@/features/editor/editorTabStore';

/** File > Next Tab, Previous Tab, Move Tab Right, Move Tab Left (Ctrl+PageDown and so on). */
export function useTabShortcuts() {
  useEffect(() => {
    const { activateAdjacentTab, moveActiveTab } = useEditorTabStore.getState();
    const handlers: [string, () => void][] = [
      [AppEvent.nextTab, () => activateAdjacentTab(1)],
      [AppEvent.previousTab, () => activateAdjacentTab(-1)],
      [AppEvent.moveTabRight, () => moveActiveTab(1)],
      [AppEvent.moveTabLeft, () => moveActiveTab(-1)],
    ];
    handlers.forEach(([event, handler]) => window.addEventListener(event, handler));
    return () => {
      handlers.forEach(([event, handler]) => window.removeEventListener(event, handler));
    };
  }, []);
}
