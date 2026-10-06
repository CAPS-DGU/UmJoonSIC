import { create } from 'zustand';

export type PanelTab = 'watch' | 'errors' | 'server';

/** Which tab the bottom panel shows. A run shows the variables; a failed load, the errors. */
export const usePanelStore = create<{ activeTab: PanelTab; setActiveTab: (tab: PanelTab) => void }>(
  set => ({
    activeTab: 'errors',
    setActiveTab: activeTab => set({ activeTab }),
  }),
);
