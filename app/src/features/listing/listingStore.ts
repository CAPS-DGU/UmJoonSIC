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
  addListing: (filePath: string, rows: ListingRow[]) => void;
  toggleBreakpoint: (filePath: string, rowIndex: number) => void;
  clearListings: () => void;
}

export const rowAddress = (row: ListingRow) => parseInt(row.addressHex, 16);

/** Rows that generate no object code (directives such as START or BASE) are never executed. */
export const hasObjectCode = (row: ListingRow) => row.rawCodeHex.replaceAll(' ', '') !== '';

/** The path of the tab that shows a file's listing. */
export const listingTabPath = (filePath: string) => path.join(filePath + '.lst');

/** The listing shown by a tab, if it is a listing tab. */
export const listingOfTab = (listings: ListingFile[], tabPath: string | null) =>
  listings.find(listing => listingTabPath(listing.filePath) === tabPath);

export const useListingStore = create<ListingState>(set => ({
  listings: [],
  addListing: (filePath, rows) =>
    set(state => ({ listings: [...state.listings, { filePath, rows, breakpoints: [] }] })),
  toggleBreakpoint: (filePath, rowIndex) =>
    set(state => ({
      listings: state.listings.map(listing => {
        if (listing.filePath !== filePath) return listing;
        const breakpoints = listing.breakpoints.includes(rowIndex)
          ? listing.breakpoints.filter(index => index !== rowIndex)
          : [...listing.breakpoints, rowIndex].sort((a, b) => a - b);
        return { ...listing, breakpoints };
      }),
    })),
  clearListings: () => set({ listings: [] }),
}));
