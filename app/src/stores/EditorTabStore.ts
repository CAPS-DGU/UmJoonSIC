import { create } from 'zustand';

export interface EditorTab {
  idx: number;
  title: string;
  filePath: string;
  isModified: boolean;
  fileContent: string;
  isActive: boolean;
  cursor: {
    line: number;
    column: number;
  };
}

interface EditorTabState {
  tabs: EditorTab[];
  getActiveTab: () => EditorTab | undefined;
  addTab: (tab: EditorTab) => void;
  closeTab: (idx: number) => void;
  setActiveTab: (idx: number) => void;
  setCursor: (idx: number, cursor: { line: number; column: number }) => void;
  setFileContent: (idx: number, fileContent: string) => void;
  clearTabs: () => void;
  setIsModified: (idx: number, isModified: boolean) => void;
}

const defaultTab: EditorTab = {
  idx: 0,
  title: 'Untitled',
  filePath: './main.asm',
  isModified: false,
  fileContent: 'hello',
  isActive: false,
  cursor: {
    line: 0,
    column: 0,
  },
};

export const useEditorTabStore = create<EditorTabState>((set, get) => ({
  tabs: [],
  getActiveTab: () => get().tabs.find(tab => tab.isActive),
  addTab: newTab =>
    set(state => {
      // 탭이 이미 열려 있으면 중복 추가 방지
      const exists = state.tabs.some(tab => tab.filePath === newTab.filePath);
      if (exists) {
        return {
          tabs: state.tabs.map(tab => ({
            ...tab,
            isActive: tab.filePath === newTab.filePath ? true : false,
          })),
        };
      }
      // 새로운 탭 추가하고 활성화 설정
      return {
        tabs: [
          ...state.tabs.map(tab => ({ ...tab, isActive: false })),
          { ...newTab, isActive: true },
        ],
      };
    }),
  closeTab: idx =>
    set(state => {
      let updatedTabs = state.tabs.filter(tab => tab.idx !== idx);
      // 닫은 탭이 활성화 탭이면, 마지막 탭을 활성화
      const wasActiveClosed = state.tabs.find(tab => tab.idx === idx)?.isActive;
      if (wasActiveClosed && updatedTabs.length > 0) {
        updatedTabs = updatedTabs.map((tab, idx) => ({
          ...tab,
          isActive: idx === updatedTabs.length - 1,
        }));
      }
      return { tabs: updatedTabs };
    }),
  setActiveTab: idx =>
    set(state => ({
      tabs: state.tabs.map(tab => ({
        ...tab,
        isActive: tab.idx === idx,
      })),
    })),
  setCursor: (idx, cursor) =>
    set(state => ({
      tabs: state.tabs.map((tab, i) => ({ ...tab, cursor: i === idx ? cursor : tab.cursor })),
    })),
  setFileContent: (idx, fileContent) =>
    set(state => ({
      tabs: state.tabs.map((tab, i) => ({
        ...tab,
        fileContent: i === idx ? fileContent : tab.fileContent,
      })),
    })),
  clearTabs: () => set(() => ({ tabs: [] })),
  setIsModified: (idx, isModified) =>
    set(state => ({
      tabs: state.tabs.map((tab, i) => ({
        ...tab,
        isModified: i === idx ? isModified : tab.isModified,
      })),
    })),
}));
