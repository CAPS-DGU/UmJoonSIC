import { create } from 'zustand';
import { BOTTOM_PANEL, DEBUG_COLUMN, FILES_COLUMN } from '@/features/layout/columns';

/** The sizes the user chose; the layout fits them into the window (see columns.ts). */
interface LayoutState {
  filesWidth: number;
  debugWidth: number;
  panelHeight: number;
  setFilesWidth: (width: number) => void;
  setDebugWidth: (width: number) => void;
  setPanelHeight: (height: number) => void;
  /** Keep the current sizes for the next start of the app. */
  save: () => void;
}

/** Kept per user, like the delay setting (not in the project). */
const STORAGE_KEY = 'umjoonsic.layout';

function readSaved() {
  const defaults = {
    filesWidth: FILES_COLUMN.default,
    debugWidth: DEBUG_COLUMN.default,
    panelHeight: BOTTOM_PANEL.default,
  };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (!saved || typeof saved !== 'object') return defaults;
    const number = (key: keyof typeof defaults) => {
      const value = (saved as Record<string, unknown>)[key];
      return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : defaults[key];
    };
    return {
      filesWidth: number('filesWidth'),
      debugWidth: number('debugWidth'),
      panelHeight: number('panelHeight'),
    };
  } catch {
    return defaults;
  }
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  ...readSaved(),
  setFilesWidth: filesWidth => set({ filesWidth: Math.round(filesWidth) }),
  setDebugWidth: debugWidth => set({ debugWidth: Math.round(debugWidth) }),
  setPanelHeight: panelHeight => set({ panelHeight: Math.round(panelHeight) }),
  save: () => {
    const { filesWidth, debugWidth, panelHeight } = get();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ filesWidth, debugWidth, panelHeight }));
    } catch (error) {
      console.warn('The layout could not be saved:', error);
    }
  },
}));
