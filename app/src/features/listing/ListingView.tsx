import { useEffect, useRef } from 'react';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import TabBar from '@/features/editor/TabBar';
import ListingTable from '@/features/listing/ListingTable';
import {
  listingOfTab,
  listingsAt,
  listingTabPath,
  useListingStore,
} from '@/features/listing/listingStore';

/** The editor area while a "List: <file>" tab is active. */
export default function ListingView() {
  const activePath = useEditorTabStore(state => state.activePath);
  const listings = useListingStore(state => state.listings);
  const toggleBreakpoint = useListingStore(state => state.toggleBreakpoint);
  const PC = useRegisterStore(state => state.PC);

  const listingCount = listings.length;
  const mounting = useRef(true);

  // Follow the PC across files: when it enters another file's code, switch to that file's
  // List tab. Only when the PC moves while a listing is shown, or once a program is loaded:
  // a List tab the user opens stays (they may look at another file's listing meanwhile, and
  // set breakpoints there).
  useEffect(() => {
    const isMount = mounting.current;
    mounting.current = false;
    const { followed, setFollowed } = useListingStore.getState();
    const now = { pc: PC, listingCount };
    if (isMount && followed !== null) {
      setFollowed(now);
      return;
    }
    // Nothing new (React runs effects twice in development).
    if (followed?.pc === PC && followed.listingCount === listingCount) return;
    const { activePath, tabs, activateTab } = useEditorTabStore.getState();
    const matches = listingsAt(useListingStore.getState().listings, PC);
    if (matches.length === 0) return;
    setFollowed(now);
    // The tab already showing a matching listing stays.
    if (matches.some(listing => listingTabPath(listing.filePath) === activePath)) return;

    const target = listingTabPath(matches[0].filePath);
    if (tabs.some(tab => tab.filePath === target)) {
      activateTab(target);
    }
  }, [PC, listingCount]);

  const listing = listingOfTab(listings, activePath);

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <TabBar />
      <ListingTable
        rows={listing?.rows ?? []}
        breakpoints={listing?.breakpoints ?? []}
        onBreakpointToggle={index => listing && toggleBreakpoint(listing.filePath, index)}
      />
    </div>
  );
}
