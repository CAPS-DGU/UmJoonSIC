import { create } from 'zustand';
import path from 'path-browserify';
import { useProjectStore } from '@/features/project/projectStore';

export interface CursorPosition {
  line: number;
  column: number;
}

export interface EditorTab {
  /** Position in `tabs`; kept equal to the array index. */
  idx: number;
  title: string;
  /** Project-relative path. A listing tab uses `<source file>.lst`, which is not a file on disk. */
  filePath: string;
  isModified: boolean;
  fileContent: string;
  /** Row indexes (listing tabs). */
  breakpoints: number[];
  isActive: boolean;
  cursor: CursorPosition;
}

/** What a caller has to say to open a tab; the rest starts from defaults. */
export type NewTab = Pick<EditorTab, 'title' | 'filePath'> & { cursor?: CursorPosition };

interface SaveAllResult {
  success: boolean;
  savedCount: number;
  totalCount: number;
  failedCount: number;
}

interface EditorTabState {
  tabs: EditorTab[];
  /** Index of the active tab; -1 when no tab is open. */
  activeTabIdx: number;
  getActiveTab: () => EditorTab | undefined;
  /** Open a tab for the file, or activate the one that is already open for it. */
  openTab: (tab: NewTab) => void;
  closeTab: (idx: number) => void;
  closeAllListFileTabs: () => void;
  setActiveTab: (idx: number) => void;
  setCursor: (idx: number, cursor: CursorPosition) => void;
  setFileContent: (idx: number, fileContent: string) => void;
  setIsModified: (idx: number, isModified: boolean) => void;
  toggleBreakpoint: (idx: number, lineNumber: number) => void;
  /** Write every modified source tab to disk (listing and project.sic tabs are skipped). */
  saveAllTabs: () => Promise<SaveAllResult>;
}

const isListingTab = (tab: EditorTab) => tab.filePath.endsWith('.lst');

/** Renumber the tabs and mark the one at `activeIdx` as active. */
const withActive = (tabs: EditorTab[], activeIdx: number): EditorTab[] =>
  tabs.map((tab, index) => ({ ...tab, idx: index, isActive: index === activeIdx }));

const patchTab = (tabs: EditorTab[], idx: number, patch: Partial<EditorTab>): EditorTab[] =>
  tabs.map(tab => (tab.idx === idx ? { ...tab, ...patch } : tab));

export const useEditorTabStore = create<EditorTabState>((set, get) => ({
  tabs: [],
  activeTabIdx: -1,

  getActiveTab: () => {
    const { tabs, activeTabIdx } = get();
    return activeTabIdx >= 0 && activeTabIdx < tabs.length ? tabs[activeTabIdx] : undefined;
  },

  openTab: ({ title, filePath, cursor }) =>
    set(state => {
      const existingIdx = state.tabs.findIndex(tab => tab.filePath === filePath);
      if (existingIdx !== -1) {
        return { tabs: withActive(state.tabs, existingIdx), activeTabIdx: existingIdx };
      }

      const newIdx = state.tabs.length;
      const newTab: EditorTab = {
        idx: newIdx,
        title,
        filePath,
        isModified: false,
        fileContent: '',
        breakpoints: [],
        isActive: true,
        cursor: cursor ?? { line: 0, column: 0 },
      };
      return { tabs: withActive([...state.tabs, newTab], newIdx), activeTabIdx: newIdx };
    }),

  closeTab: idx =>
    set(state => {
      const closedTabWasActive = state.tabs[idx]?.idx === state.activeTabIdx;
      const remaining = state.tabs.filter(tab => tab.idx !== idx);

      let newActiveIdx = -1;
      if (remaining.length > 0) {
        if (closedTabWasActive) {
          // The active tab was closed: the last tab takes over.
          newActiveIdx = remaining.length - 1;
        } else {
          // Another tab was closed: the active tab stays active at its new position.
          const activeTab = state.tabs[state.activeTabIdx];
          if (activeTab) {
            newActiveIdx = remaining.findIndex(t => t.filePath === activeTab.filePath);
          }
        }
      }
      return { tabs: withActive(remaining, newActiveIdx), activeTabIdx: newActiveIdx };
    }),

  closeAllListFileTabs: () =>
    set(state => {
      const activeTab = state.tabs[state.activeTabIdx];
      const remaining = state.tabs.filter(tab => !isListingTab(tab));

      let newActiveIdx = -1;
      if (remaining.length > 0) {
        if (activeTab && !isListingTab(activeTab)) {
          const idx = remaining.findIndex(t => t.filePath === activeTab.filePath);
          newActiveIdx = idx !== -1 ? idx : remaining.length - 1;
        } else {
          newActiveIdx = remaining.length - 1;
        }
      }
      return { tabs: withActive(remaining, newActiveIdx), activeTabIdx: newActiveIdx };
    }),

  setActiveTab: idx => set(state => ({ tabs: withActive(state.tabs, idx), activeTabIdx: idx })),

  setCursor: (idx, cursor) => set(state => ({ tabs: patchTab(state.tabs, idx, { cursor }) })),
  setFileContent: (idx, fileContent) =>
    set(state => ({ tabs: patchTab(state.tabs, idx, { fileContent }) })),
  setIsModified: (idx, isModified) =>
    set(state => ({ tabs: patchTab(state.tabs, idx, { isModified }) })),

  toggleBreakpoint: (idx, lineNumber) =>
    set(state => {
      const tab = state.tabs.find(t => t.idx === idx);
      if (!tab) return state;
      const breakpoints = tab.breakpoints || [];
      const next = breakpoints.includes(lineNumber)
        ? breakpoints.filter(bp => bp !== lineNumber)
        : [...breakpoints, lineNumber].sort((a, b) => a - b);
      return { tabs: patchTab(state.tabs, idx, { breakpoints: next }) };
    }),

  saveAllTabs: async () => {
    const { projectPath } = useProjectStore.getState();
    const modifiedTabs = get().tabs.filter(
      tab => tab.isModified && !isListingTab(tab) && !tab.filePath.endsWith('.sic'),
    );
    if (modifiedTabs.length === 0) {
      return { success: true, savedCount: 0, totalCount: 0, failedCount: 0 };
    }

    const results = await Promise.all(
      modifiedTabs.map(async tab => {
        const fullPath = path.join(projectPath, tab.filePath);
        try {
          const res = await window.api.saveFile(fullPath, tab.fileContent);
          if (!res.success) {
            console.error(`파일 저장 실패: ${fullPath}`, res.message);
            return false;
          }
          get().setIsModified(tab.idx, false);
          return true;
        } catch (error) {
          console.error(`파일 저장 중 오류 발생: ${fullPath}`, error);
          return false;
        }
      }),
    );

    const savedCount = results.filter(Boolean).length;
    const failedCount = results.length - savedCount;
    return {
      success: failedCount === 0,
      savedCount,
      totalCount: modifiedTabs.length,
      failedCount,
    };
  },
}));
