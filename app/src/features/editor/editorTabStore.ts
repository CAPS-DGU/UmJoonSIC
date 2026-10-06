import { create } from 'zustand';
import path from 'path-browserify';
import {
  cancelScheduledCheck,
  checkSyntax,
  isProjectAsmFile,
} from '@/features/editor/lib/syntaxCheck';
import { disposeModel, modelPath } from '@/features/editor/monaco/models';
import { useErrorStore } from '@/features/panel/errorStore';
import { useProjectStore } from '@/features/project/projectStore';
import { moveItem } from '@/lib/moveItem';
import { strings } from '@/i18n';
import { showError } from '@/stores/dialogStore';

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
  /** Where the editor is asked to put the cursor; cleared once it has done so. */
  revealRequest: RevealRequest | null;
  /**
   * Open a tab for the file, or activate the one already open. A source file is read
   * from disk first, so a tab always has its content; if it cannot be read, no tab opens.
   */
  openTab: (tab: NewTab) => Promise<void>;
  clearRevealRequest: (id: number) => void;
  activateTab: (filePath: string) => void;
  /** Activate the next (1) or the previous (-1) tab, going round at the ends. */
  activateAdjacentTab: (offset: 1 | -1) => void;
  /** Move a tab to another place in the tab bar (0 is the first). */
  moveTab: (filePath: string, toIndex: number) => void;
  /** Move the active tab one place to the right (1) or to the left (-1). */
  moveActiveTab: (offset: 1 | -1) => void;
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
  if (filePath.toLowerCase().endsWith('.lst')) return 'listing';
  // Only the project's own project.sic, at its root.
  if (filePath === 'project.sic') return 'settings';
  return 'source';
}

export const selectActiveTab = (state: EditorTabState) =>
  state.tabs.find(tab => tab.filePath === state.activePath);

/** The open source tab whose Monaco model this is (see monaco/models.ts). */
export function tabPathOfModel(modelUri: string) {
  const { projectPath } = useProjectStore.getState();
  return useEditorTabStore
    .getState()
    .tabs.find(
      tab =>
        tabKind(tab.filePath) === 'source' && modelPath(projectPath, tab.filePath) === modelUri,
    )?.filePath;
}

const absolutePath = (filePath: string) =>
  path.join(useProjectStore.getState().projectPath, filePath);

let nextRevealId = 0;
/** Counts openTab calls: when two overlap, the one asked for last is activated. */
let lastOpenRequest = 0;
/** Changes when all tabs are closed (another project), so that a late file read is dropped. */
let tabsEpoch = 0;

/**
 * The tabs in the order they were last active (most recent last). When the active tab
 * closes, the one used before it comes back, not whichever tab is last in the strip (the
 * settings tab came forward when a run's List tab closed).
 */
let activeHistory: string[] = [];
const noteActive = (filePath: string | null) => {
  if (!filePath) return;
  activeHistory = [...activeHistory.filter(p => p !== filePath), filePath].slice(-30);
};

export const useEditorTabStore = create<EditorTabState>((set, get) => {
  const patchTab = (filePath: string, patch: (tab: EditorTab) => Partial<EditorTab>) =>
    set(state => ({
      tabs: state.tabs.map(tab => (tab.filePath === filePath ? { ...tab, ...patch(tab) } : tab)),
    }));

  /** The content of a source file on disk, or null (after telling the user) if it cannot be read. */
  const readContent = async (filePath: string) => {
    let message: string;
    try {
      const res = await window.api.readFile(absolutePath(filePath));
      if (res.success) return res.data ?? '';
      message = res.message ?? '';
    } catch (error) {
      message = String(error);
    }
    void showError(strings().messages.openFileFailed(filePath), undefined, message);
    return null;
  };

  /** Remove tabs; when the active one goes, the last remaining tab takes over. */
  const removeTabs = (shouldClose: (tab: EditorTab) => boolean) => {
    const { tabs, activePath } = get();
    const closing = tabs.filter(shouldClose);
    if (closing.length === 0) return;
    const remaining = tabs.filter(tab => !shouldClose(tab));
    const activeStays = remaining.some(tab => tab.filePath === activePath);
    const previous = [...activeHistory]
      .reverse()
      .find(p => remaining.some(tab => tab.filePath === p));
    const nextActive = activeStays ? activePath : (previous ?? remaining.at(-1)?.filePath ?? null);
    activeHistory = activeHistory.filter(p => remaining.some(tab => tab.filePath === p));
    set({ tabs: remaining, activePath: nextActive });
    const { projectPath } = useProjectStore.getState();
    closing
      .filter(tab => tabKind(tab.filePath) === 'source')
      .forEach(tab => {
        cancelScheduledCheck(tab.filePath);
        disposeModel(projectPath, tab.filePath);
      });
  };

  return {
    tabs: [],
    activePath: null,
    revealRequest: null,

    openTab: async ({ title, filePath, cursor }) => {
      const request = ++lastOpenRequest;
      const isOpen = () => get().tabs.some(tab => tab.filePath === filePath);
      if (!isOpen()) {
        const epoch = tabsEpoch;
        const content = tabKind(filePath) === 'source' ? await readContent(filePath) : '';
        // The file could not be read, or the project was closed while it was read.
        if (content === null || epoch !== tabsEpoch) return;
        // The tab may have been opened meanwhile (a second click).
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
          // A file the last load reported errors for already has them (and its error lines).
          const hasLoadErrors = useErrorStore
            .getState()
            .errors[filePath]?.some(err => err.type === 'load');
          if (content && isProjectAsmFile(filePath) && !hasLoadErrors) {
            checkSyntax([content], [filePath]);
          }
        }
      }
      // A later request (another file clicked while this one was read) wins.
      if (request !== lastOpenRequest) return;
      set({
        activePath: filePath,
        ...(cursor && { revealRequest: { filePath, ...cursor, id: nextRevealId++ } }),
      });
    },

    clearRevealRequest: id =>
      set(state => (state.revealRequest?.id === id ? { revealRequest: null } : {})),

    activateTab: filePath => set({ activePath: filePath }),

    activateAdjacentTab: offset => {
      const { tabs, activePath } = get();
      if (tabs.length === 0) return;
      const index = tabs.findIndex(tab => tab.filePath === activePath);
      // Without an active tab, the first (next) or the last (previous) one.
      const next = index < 0 ? (offset > 0 ? 0 : tabs.length - 1) : index + offset;
      set({ activePath: tabs[(next + tabs.length) % tabs.length].filePath });
    },

    moveTab: (filePath, toIndex) =>
      set(state => {
        const from = state.tabs.findIndex(tab => tab.filePath === filePath);
        const to = Math.max(0, Math.min(toIndex, state.tabs.length - 1));
        return from < 0 || from === to ? {} : { tabs: moveItem(state.tabs, from, to) };
      }),

    moveActiveTab: offset => {
      const { tabs, activePath, moveTab } = get();
      const index = tabs.findIndex(tab => tab.filePath === activePath);
      if (index >= 0) moveTab(tabs[index].filePath, index + offset);
    },

    closeTab: filePath => {
      const tab = get().tabs.find(t => t.filePath === filePath);
      removeTabs(t => t.filePath === filePath);
      // Its unsaved edits are gone: errors from them would no longer match the file.
      if (tab && tab.content !== tab.savedContent && isProjectAsmFile(filePath)) {
        checkSyntax([tab.savedContent], [filePath]);
      }
    },
    closeListingTabs: () => removeTabs(tab => tabKind(tab.filePath) === 'listing'),
    closeAllTabs: () => {
      tabsEpoch++;
      removeTabs(() => true);
      set({ revealRequest: null });
    },
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
          console.error(`Saving ${filePath} failed:`, res.message);
          return false;
        }
      } catch (error) {
        console.error(`Saving ${filePath} failed:`, error);
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

// Every activation is remembered (see activeHistory).
useEditorTabStore.subscribe((state, prev) => {
  if (state.activePath !== prev.activePath) noteActive(state.activePath);
});
