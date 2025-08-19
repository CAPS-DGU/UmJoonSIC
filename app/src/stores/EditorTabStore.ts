import { create } from "zustand";


export interface EditorTab {
    idx?: number;
    title: string;
    filePath: string;
    isModified: boolean;
    fileContent: string;
    cursor: {
        line: number;
        column: number;
    };
}

interface EditorTabState {
    tabs: EditorTab[];
    activeTab: number;
    addTab: (tab: EditorTab) => void;
    closeTab: (idx: number) => void;
    setActiveTab: (idx: number) => void;
    setCursor: (idx: number, cursor: { line: number; column: number }) => void;
    setFileContent: (idx: number, fileContent: string) => void;
    clearTabs: () => void;
}

const defaultTab: EditorTab = {
    idx: 0,
    title: "Untitled",
    filePath: "./main.asm",
    isModified: false,
    fileContent: "hello",
    cursor: {
        line: 0,
        column: 0,
    },
}

export const useEditorTabStore = create<EditorTabState>((set) => ({
    tabs: [],
    activeTab: 0,
    addTab: (tab) => set((state) => {
        // const exists = state.tabs.some((tab) => tab.idx === tab.idx);
        // if (!exists) {
            return { tabs: [...state.tabs, { ...tab, idx: state.tabs.length }] };
        // } else {
        //     return state;
        // }
    }),
    closeTab: (idx) => set((state) => ({ tabs: state.tabs.filter((_, i) => i !== idx) })),
    setActiveTab: (idx) => set((state) => ({ activeTab: idx })),
    setCursor: (idx, cursor) => set((state) => ({ tabs: state.tabs.map((tab, i) => ({ ...tab, cursor: i === idx ? cursor : tab.cursor })) })),
    setFileContent: (idx, fileContent) => set((state) => ({ tabs: state.tabs.map((tab, i) => ({ ...tab, fileContent: i === idx ? fileContent : tab.fileContent })) })),
    clearTabs: () => set({ tabs: [] })
}));