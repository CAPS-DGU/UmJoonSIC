import { create } from 'zustand';
import type { ListingRow } from '@/api/types';

/** The assembly listing of one source file, as returned when a program is loaded. */
export interface ListingFile {
  filePath: string;
  rows: ListingRow[];
}

interface ListingState {
  listings: ListingFile[];
  addListing: (filePath: string, rows: ListingRow[]) => void;
  clearListings: () => void;
}

export const useListingStore = create<ListingState>(set => ({
  listings: [],
  addListing: (filePath, rows) =>
    set(state => ({ listings: [...state.listings, { filePath, rows }] })),
  clearListings: () => set({ listings: [] }),
}));
