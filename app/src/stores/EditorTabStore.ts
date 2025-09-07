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

// const defaultTab: EditorTab = {
//   idx: 0,
//   title: 'Untitled',
//   filePath: './main.asm',
//   isModified: false,
//   fileContent: 'hello',
//   breakpoints: [],
//   isActive: false,
//   cursor: {
//     line: 0,
//     column: 0,
//   },
// };

// 'activeTabIdx'를 기준으로 모든 탭의 'isActive' 상태를 동기화하는 헬퍼 함수
const syncActiveState = (tabs: EditorTab[], activeIdx: number): EditorTab[] => {
  return tabs.map((tab, index) => ({
    ...tab,
    isActive: index === activeIdx,
  }));
};

export const useEditorTabStore = create<EditorTabState>((set, get) => ({
  tabs: [],
  activeTabIdx: -1, // default value (e.g., -1 for no active tab)

  getActiveTab: () => {
    const { tabs, activeTabIdx } = get();
    // 유효한 인덱스인지 확인 후 반환
    if (activeTabIdx >= 0 && activeTabIdx < tabs.length) {
      return tabs[activeTabIdx];
    }
    return undefined;
  },

  addTab: newTab =>
    set(state => {
      const exists = state.tabs.some(tab => tab.filePath === newTab.filePath);
      // 이미 탭이 존재하는 경우
      if (exists) {
        const newActiveTabIdx = state.tabs.findIndex(tab => tab.filePath === newTab.filePath);
        const syncedTabs = syncActiveState(state.tabs, newActiveTabIdx);
        return { tabs: syncedTabs, activeTabIdx: newActiveTabIdx };
      }

      // 새 탭 추가하는 경우
      const newIdx = state.tabs.length;
      const updatedTabs = [...state.tabs, { ...newTab, idx: newIdx }];
      const syncedTabs = syncActiveState(updatedTabs, newIdx);
      return { tabs: syncedTabs, activeTabIdx: newIdx };
    }),

  closeTab: idx =>
    set(state => {
      const closedTabWasActive = state.tabs[idx]?.idx === state.activeTabIdx;
      const updatedTabs = state.tabs.filter(tab => tab.idx !== idx);
      const reindexedTabs = updatedTabs.map((tab, i) => ({ ...tab, idx: i }));

      let newActiveTabIdx = -1;
      if (reindexedTabs.length > 0) {
        if (closedTabWasActive) {
          // 닫은 탭이 활성 탭이었다면, 마지막 탭을 활성화
          newActiveTabIdx = reindexedTabs.length - 1;
        } else {
          // 다른 탭을 닫았다면, 기존 활성 탭의 새 인덱스 찾기
          const oldActiveTab = state.tabs[state.activeTabIdx];
          if (oldActiveTab) {
            newActiveTabIdx = reindexedTabs.findIndex(t => t.filePath === oldActiveTab.filePath);
          }
        }
      }

      const finalTabs = syncActiveState(reindexedTabs, newActiveTabIdx);
      return {
        tabs: finalTabs,
        activeTabIdx: newActiveTabIdx,
      };
    }),
  closeAllListFileTabs: () => {
    set(state => {
      const wasActive = state.tabs[state.activeTabIdx];
      const filtered = state.tabs.filter(tab => !tab.filePath.endsWith('.lst'));
      const reindexed = filtered.map((tab, i) => ({ ...tab, idx: i }));

      let newActiveIdx = -1;
      if (reindexed.length > 0) {
        if (wasActive && !wasActive.filePath.endsWith('.lst')) {
          const idx = reindexed.findIndex(t => t.filePath === wasActive.filePath);
          newActiveIdx = idx !== -1 ? idx : reindexed.length - 1;
        } else {
          newActiveIdx = reindexed.length - 1;
        }
      }

      const syncedTabs = syncActiveState(reindexed, newActiveIdx);
      return {
        tabs: syncedTabs,
        activeTabIdx: newActiveIdx,
      };
    });
  },
  setActiveTab: idx =>
    set(state => {
      const syncedTabs = syncActiveState(state.tabs, idx);
      return {
        tabs: syncedTabs,
        activeTabIdx: idx,
      };
    }),

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
    console.log(`${tab?.filePath}의 ${lineNumber}줄 에서 브레이크 포인트 클릭!`);
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
