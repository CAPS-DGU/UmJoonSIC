import { create } from 'zustand';
import path from 'path-browserify';
import type { ListingRow } from '@/api/types';

/** The assembly listing of one source file, as returned when a program is loaded. */
export interface ListingFile {
  /** The source file, as the simulator names it. Its tab is `<filePath>.lst` (see listingTabPath). */
  filePath: string;
  rows: ListingRow[];
  /** Indexes of the rows that have a breakpoint. */
  breakpoints: number[];
}

interface ListingState {
  listings: ListingFile[];
  /**
   * Breakpoints by file, kept when a run ends so that the next run (Restart, or Stop and
   * Run) has them again. A breakpoint belongs to a row's address and text, so it is dropped
   * when that row no longer exists after an edit.
   */
  savedBreakpoints: ReadonlyMap<string, ReadonlySet<string>>;
  /**
   * What the List tabs last followed (see ListingView): the PC, with the number of listings
   * loaded then. Null until they have followed the PC in this run.
   */
  followed: { pc: number; listingCount: number } | null;
  setFollowed: (followed: { pc: number; listingCount: number }) => void;
  /** Add a file's listing, with the breakpoints it had in an earlier run. */
  addListing: (filePath: string, rows: ListingRow[]) => void;
  toggleBreakpoint: (filePath: string, rowIndex: number) => void;
  /** End of a run: the listings go, their breakpoints are kept. */
  clearListings: () => void;
  /** Another project: forget the breakpoints too. */
  forgetBreakpoints: () => void;
}

/** What identifies a row across runs. */
const rowKey = (row: ListingRow) => [row.addressHex, row.label, row.instr, row.operand].join('|');

export const rowAddress = (row: ListingRow) => parseInt(row.addressHex, 16);

/** Rows that generate no object code (directives such as START or BASE) are never executed. */
export const hasObjectCode = (row: ListingRow) => row.rawCodeHex.replaceAll(' ', '') !== '';

/** True if a row at `address` has a breakpoint, in any file's listing. */
export const breakpointAt = (listings: ListingFile[], address: number) =>
  listings.some(listing =>
    listing.breakpoints.some(index => rowAddress(listing.rows[index]) === address),
  );

/** The listings in which the instruction at `address` is (the code the PC is in). */
export const listingsAt = (listings: ListingFile[], address: number) =>
  listings.filter(listing =>
    listing.rows.some(row => rowAddress(row) === address && hasObjectCode(row)),
  );

/** The path of the tab that shows a file's listing. */
export const listingTabPath = (filePath: string) => path.join(filePath + '.lst');

/** The listing shown by a tab, if it is a listing tab. */
export const listingOfTab = (listings: ListingFile[], tabPath: string | null) =>
  listings.find(listing => listingTabPath(listing.filePath) === tabPath);

export const useListingStore = create<ListingState>(set => ({
  listings: [],
  savedBreakpoints: new Map(),
  followed: null,

  setFollowed: followed => set({ followed }),

  addListing: (filePath, rows) =>
    set(state => {
      const saved = state.savedBreakpoints.get(filePath);
      const breakpoints = saved
        ? rows.flatMap((row, index) => (!row.isCommentRow && saved.has(rowKey(row)) ? [index] : []))
        : [];
      return { listings: [...state.listings, { filePath, rows, breakpoints }] };
    }),

  toggleBreakpoint: (filePath, rowIndex) =>
    set(state => {
      const listings = state.listings.map(listing => {
        if (listing.filePath !== filePath) return listing;
        const breakpoints = listing.breakpoints.includes(rowIndex)
          ? listing.breakpoints.filter(index => index !== rowIndex)
          : [...listing.breakpoints, rowIndex].sort((a, b) => a - b);
        return { ...listing, breakpoints };
      });
      const listing = listings.find(l => l.filePath === filePath);
      const savedBreakpoints = new Map(state.savedBreakpoints);
      if (listing) {
        savedBreakpoints.set(
          filePath,
          new Set(listing.breakpoints.map(i => rowKey(listing.rows[i]))),
        );
      }
      return { listings, savedBreakpoints };
    }),

  clearListings: () => set({ listings: [], followed: null }),
  forgetBreakpoints: () => set({ listings: [], savedBreakpoints: new Map(), followed: null }),
}));
