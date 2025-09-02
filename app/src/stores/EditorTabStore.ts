import { create } from 'zustand';

export interface EditorTab {
  idx: number;
  title: string;
  filePath: string;
  isModified: boolean;
  fileContent: string;
  breakpoints: number[];
  isActive: boolean;
  cursor: {
    line: number;
    column: number;
  };
}

// Add activeTabIdx to the state interface
interface EditorTabState {
  tabs: EditorTab[];
  activeTabIdx: number; // New property to track the active tab's index
  getActiveTab: () => EditorTab | undefined;
  addTab: (tab: EditorTab) => void;
  closeTab: (idx: number) => void;
  closeAllListFileTabs: () => void;
  setActiveTab: (idx: number) => void;
  setCursor: (idx: number, cursor: { line: number; column: number }) => void;
  setFileContent: (idx: number, fileContent: string) => void;
  clearTabs: () => void;
  setIsModified: (idx: number, isModified: boolean) => void;
  // Breakpoint 관련 함수들
  addBreakpoint: (idx: number, lineNumber: number) => void;
  removeBreakpoint: (idx: number, lineNumber: number) => void;
  toggleBreakpoint: (idx: number, lineNumber: number) => void;
  clearBreakpoints: (idx: number) => void;
}

const defaultTab: EditorTab = {
  idx: 0,
  title: 'Untitled',
  filePath: './main.asm',
  isModified: false,
  fileContent: 'hello',
  breakpoints: [],
  isActive: false,
  cursor: {
    line: 0,
    column: 0,
  },
};

export const useEditorTabStore = create<EditorTabState>((set, get) => ({
  tabs: [],
  activeTabIdx: -1, // default value (e.g., -1 for no active tab)
  getActiveTab: () => get().tabs.find(tab => tab.isActive),
  addTab: newTab =>
    set(state => {
      const exists = state.tabs.some(tab => tab.filePath === newTab.filePath);
      if (exists) {
        const newActiveTabIdx = state.tabs.findIndex(tab => tab.filePath === newTab.filePath);
        return {
          tabs: state.tabs.map(tab => ({
            ...tab,
            breakpoints: tab.breakpoints || [],
            isActive: tab.filePath === newTab.filePath ? true : false,
          })),
          activeTabIdx: newActiveTabIdx,
        };
      }
      const newIdx = state.tabs.length;
      return {
        tabs: [
          ...state.tabs.map(tab => ({
            ...tab,
            breakpoints: tab.breakpoints || [],
            isActive: false,
          })),
          {
            ...newTab,
            breakpoints: newTab.breakpoints || [],
            isActive: true,
            idx: newIdx,
          },
        ],
        activeTabIdx: newIdx,
      };
    }),
  closeTab: idx =>
    set(state => {
      const closedTabIsActive = state.tabs[idx]?.isActive;
      const updatedTabs = state.tabs.filter(tab => tab.idx !== idx);

      const reindexedTabs = updatedTabs.map((tab, i) => ({ ...tab, idx: i }));

      let newActiveTabIdx = -1;
      if (reindexedTabs.length > 0) {
        if (closedTabIsActive) {
          newActiveTabIdx = reindexedTabs.length - 1;
        } else {
          const currentActiveTab = state.tabs.find(tab => tab.isActive);
          newActiveTabIdx = currentActiveTab
            ? reindexedTabs.findIndex(tab => tab.filePath === currentActiveTab.filePath)
            : -1;
        }
      }

      const finalTabs = reindexedTabs.map((tab, i) => ({
        ...tab,
        isActive: i === newActiveTabIdx,
      }));

      return {
        tabs: finalTabs,
        activeTabIdx: newActiveTabIdx,
      };
    }),
  closeAllListFileTabs: () => {
    const { closeTab } = get();
    get().tabs.forEach(tab => {
      if (tab.filePath.endsWith('.lst')) {
        closeTab(tab.idx);
      }
    });
    set(state => ({
      tabs: state.tabs.filter(tab => !tab.filePath.endsWith('.lst')),
      activeTabIdx: state.activeTabIdx,
    }));
  },
  setActiveTab: idx =>
    set(state => ({
      tabs: state.tabs.map(tab => ({
        ...tab,
        isActive: tab.idx === idx,
      })),
      activeTabIdx: idx,
    })),
  setCursor: (idx, cursor) =>
    set(state => ({
      tabs: state.tabs.map(tab => ({ ...tab, cursor: tab.idx === idx ? cursor : tab.cursor })),
    })),
  setFileContent: (idx, fileContent) =>
    set(state => ({
      tabs: state.tabs.map(tab => ({
        ...tab,
        fileContent: tab.idx === idx ? fileContent : tab.fileContent,
      })),
    })),
  clearTabs: () => set(() => ({ tabs: [], activeTabIdx: -1 })),
  setIsModified: (idx, isModified) =>
    set(state => ({
      tabs: state.tabs.map(tab => ({
        ...tab,
        isModified: tab.idx === idx ? isModified : tab.isModified,
      })),
    })),
  // Breakpoint 관련 함수들
  addBreakpoint: (idx, lineNumber) =>
    set(state => ({
      tabs: state.tabs.map(tab => {
        if (tab.idx === idx) {
          const breakpoints = tab.breakpoints || [];
          if (!breakpoints.includes(lineNumber)) {
            return {
              ...tab,
              breakpoints: [...breakpoints, lineNumber].sort((a, b) => a - b),
            };
          }
        }
        return tab;
      }),
    })),
  removeBreakpoint: (idx, lineNumber) =>
    set(state => ({
      tabs: state.tabs.map(tab => {
        if (tab.idx === idx) {
          const breakpoints = tab.breakpoints || [];
          return {
            ...tab,
            breakpoints: breakpoints.filter(bp => bp !== lineNumber),
          };
        }
        return tab;
      }),
    })),
  toggleBreakpoint: (idx, lineNumber) => {
    const { tabs } = get();
    const tab = tabs.find(t => t.idx === idx);
    if (tab && tab.breakpoints && tab.breakpoints.includes(lineNumber)) {
      get().removeBreakpoint(idx, lineNumber);
    } else {
      get().addBreakpoint(idx, lineNumber);
    }
  },
  clearBreakpoints: idx =>
    set(state => ({
      tabs: state.tabs.map(tab => {
        if (tab.idx === idx) {
          return {
            ...tab,
            breakpoints: [],
          };
        }
        return tab;
      }),
    })),
}));
