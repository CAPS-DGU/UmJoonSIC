import { useEffect } from 'react';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import TabBar from '@/features/editor/TabBar';
import ListingTable from '@/features/listing/ListingTable';
import {
  hasObjectCode,
  listingOfTab,
  listingTabPath,
  rowAddress,
  useListingStore,
} from '@/features/listing/listingStore';

/** The editor area while a "List: <file>" tab is active. */
export default function ListingView() {
  const activePath = useEditorTabStore(state => state.activePath);
  const listings = useListingStore(state => state.listings);
  const toggleBreakpoint = useListingStore(state => state.toggleBreakpoint);
  const PC = useRegisterStore(state => state.PC);

  const listingCount = listings.length;

  // Follow the PC across files: when it enters another file's code, switch to that file's
  // List tab. Only when the PC moves (or a program is loaded): the user may look at another
  // file's listing meanwhile, and set breakpoints there.
  useEffect(() => {
    const { activePath, tabs, activateTab } = useEditorTabStore.getState();
    const matches = useListingStore
      .getState()
      .listings.filter(listing =>
        listing.rows.some(row => rowAddress(row) === PC && hasObjectCode(row)),
      );
    if (matches.length === 0) return;
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
