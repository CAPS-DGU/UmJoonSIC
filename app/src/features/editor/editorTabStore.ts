import { create } from 'zustand';
import path from 'path-browserify';
import { checkSyntax, isProjectAsmFile } from '@/features/editor/lib/syntaxCheck';
import { disposeModel } from '@/features/editor/monaco/models';
import { useProjectStore } from '@/features/project/projectStore';

export interface CursorPosition {
  line: number;
  column: number;
}

/** What a tab shows: a source file in the editor, a listing during a run, or project.sic. */
export type TabKind = 'source' | 'listing' | 'settings';

export interface EditorTab {
  title: string;
  /**
   * Project-relative path; identifies the tab. A listing tab uses `<source file>.lst`,
   * which is not a file on disk; the settings tab is `project.sic`.
   */
  filePath: string;
  /** Source tabs: the text being edited. */
  content: string;
  /** Source tabs: the text as it was last read from or written to disk. */
  savedContent: string;
  /** Changes that are not saved: edited text, or an edited settings form. */
  isModified: boolean;
  /** Cursor position, shown in the status bar. */
  cursor: CursorPosition;
}

/** A request to the editor to put the cursor at a position (for example an error's). */
export interface RevealRequest extends CursorPosition {
  filePath: string;
  /** Distinguishes two requests for the same position. */
  id: number;
}

/** What a caller has to say to open a tab; `cursor` also moves an open tab's cursor. */
export type NewTab = Pick<EditorTab, 'title' | 'filePath'> & { cursor?: CursorPosition };

interface SaveAllResult {
  success: boolean;
  savedCount: number;
  totalCount: number;
  failedCount: number;
}

interface EditorTabState {
  tabs: EditorTab[];
  /** `filePath` of the active tab; null when no tab is open. */
  activePath: string | null;
  revealRequest: RevealRequest | null;
  /**
   * Open a tab for the file, or activate the one already open. A source file is read
   * from disk first, so a tab always has its content.
   */
  openTab: (tab: NewTab) => Promise<void>;
  activateTab: (filePath: string) => void;
  /** Close a tab, unsaved changes included (ask first: see unsavedChanges.ts). */
  closeTab: (filePath: string) => void;
  closeListingTabs: () => void;
  closeAllTabs: () => void;
  /** Close the tabs of a deleted file, or of every file under a deleted folder. */
  closeTabsUnder: (relativePath: string) => void;
  setContent: (filePath: string, content: string) => void;
  setCursor: (filePath: string, cursor: CursorPosition) => void;
  /** For tabs whose changes live elsewhere (the settings form). */
  setModified: (filePath: string, isModified: boolean) => void;
  /** Write a source tab to disk. Resolves to false if that failed. */
  saveTab: (filePath: string) => Promise<boolean>;
  /** Write every modified source tab to disk. */
  saveAllTabs: () => Promise<SaveAllResult>;
}

export function tabKind(filePath: string): TabKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.lst')) return 'listing';
  if (lower.endsWith('project.sic')) return 'settings';
  return 'source';
}

export const selectActiveTab = (state: EditorTabState) =>
  state.tabs.find(tab => tab.filePath === state.activePath);

const absolutePath = (filePath: string) =>
  path.join(useProjectStore.getState().projectPath, filePath);

let nextRevealId = 0;

export const useEditorTabStore = create<EditorTabState>((set, get) => {
  const patchTab = (filePath: string, patch: (tab: EditorTab) => Partial<EditorTab>) =>
    set(state => ({
      tabs: state.tabs.map(tab => (tab.filePath === filePath ? { ...tab, ...patch(tab) } : tab)),
    }));

  /** The content of a source file on disk ('' if it cannot be read). */
  const readContent = async (filePath: string) => {
    try {
      const res = await window.api.readFile(absolutePath(filePath));
      if (res.success) return res.data ?? '';
      console.error('Failed to load file:', res.message);
    } catch (error) {
      console.error('Failed to load file:', error);
    }
    return '';
  };

  /** Remove tabs; when the active one goes, the last remaining tab takes over. */
  const removeTabs = (shouldClose: (tab: EditorTab) => boolean) => {
    const { tabs, activePath } = get();
    const closing = tabs.filter(shouldClose);
    if (closing.length === 0) return;
    const remaining = tabs.filter(tab => !shouldClose(tab));
    const activeStays = remaining.some(tab => tab.filePath === activePath);
    set({
      tabs: remaining,
      activePath: activeStays ? activePath : (remaining.at(-1)?.filePath ?? null),
    });
    const { projectPath } = useProjectStore.getState();
    closing
      .filter(tab => tabKind(tab.filePath) === 'source')
      .forEach(tab => disposeModel(projectPath, tab.filePath));
  };

  return {
    tabs: [],
    activePath: null,
    revealRequest: null,

    openTab: async ({ title, filePath, cursor }) => {
      const isOpen = () => get().tabs.some(tab => tab.filePath === filePath);
      if (!isOpen()) {
        const { projectPath } = useProjectStore.getState();
        const isSource = tabKind(filePath) === 'source';
        const content = isSource ? await readContent(filePath) : '';
        // While the file was read, the project may have changed, or the tab been opened.
        if (useProjectStore.getState().projectPath !== projectPath) return;
        if (!isOpen()) {
          const tab: EditorTab = {
            title,
            filePath,
            content,
            savedContent: content,
            isModified: false,
            cursor: cursor ?? { line: 1, column: 1 },
          };
          set(state => ({ tabs: [...state.tabs, tab] }));
          if (content && isProjectAsmFile(filePath)) {
            checkSyntax([content], [filePath]);
          }
        }
      }
      set({
        activePath: filePath,
        ...(cursor && { revealRequest: { filePath, ...cursor, id: nextRevealId++ } }),
      });
    },

    activateTab: filePath => set({ activePath: filePath }),

    closeTab: filePath => removeTabs(tab => tab.filePath === filePath),
    closeListingTabs: () => removeTabs(tab => tabKind(tab.filePath) === 'listing'),
    closeAllTabs: () => removeTabs(() => true),
    closeTabsUnder: relativePath =>
      removeTabs(
        tab => tab.filePath === relativePath || tab.filePath.startsWith(`${relativePath}/`),
      ),

    setContent: (filePath, content) =>
      patchTab(filePath, tab => ({ content, isModified: content !== tab.savedContent })),
    setCursor: (filePath, cursor) => patchTab(filePath, () => ({ cursor })),
    setModified: (filePath, isModified) => patchTab(filePath, () => ({ isModified })),

    saveTab: async filePath => {
      const tab = get().tabs.find(t => t.filePath === filePath);
      if (!tab || tabKind(filePath) !== 'source') return false;
      const { content } = tab;
      try {
        const res = await window.api.saveFile(absolutePath(filePath), content);
        if (!res.success) {
          console.error(`파일 저장 실패: ${filePath}`, res.message);
          return false;
        }
      } catch (error) {
        console.error(`파일 저장 중 오류 발생: ${filePath}`, error);
        return false;
      }
      // Typing may have gone on while the file was written: compare with what was saved.
      patchTab(filePath, current => ({
        savedContent: content,
        isModified: current.content !== content,
      }));
      return true;
    },

    saveAllTabs: async () => {
      const modified = get().tabs.filter(
        tab => tab.isModified && tabKind(tab.filePath) === 'source',
      );
      const results = await Promise.all(modified.map(tab => get().saveTab(tab.filePath)));
      const savedCount = results.filter(Boolean).length;
      const failedCount = results.length - savedCount;
      return { success: failedCount === 0, savedCount, totalCount: modified.length, failedCount };
    },
  };
});
