import { ScrollText } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useRegisterStore } from '@/features/debugger/registerStore';
import TabBar from '@/features/editor/TabBar';
import ListingTable from '@/features/listing/ListingTable';
import { listingsAt, shownListing, useListingStore } from '@/features/listing/listingStore';
import { useStrings } from '@/i18n';

/**
 * The run's List tab: one mini-tab per loaded file (in the assembly order), the listing of the
 * chosen one below. A run shows its listing: closing the tab stops the run (TabBar).
 */
export default function ListingView() {
  const t = useStrings();
  const listings = useListingStore(state => state.listings);
  const activeFile = useListingStore(state => state.activeFile);
  const setActiveFile = useListingStore(state => state.setActiveFile);
  const toggleBreakpoint = useListingStore(state => state.toggleBreakpoint);
  const PC = useRegisterStore(state => state.PC);

  const listingCount = listings.length;
  const mounting = useRef(true);

  // Follow the PC across files: when it enters another file's code, show that file's
  // listing. Only when the PC moves, or once a program is loaded: a listing the user chose
  // stays (they may look at another file meanwhile, and set breakpoints there).
  useEffect(() => {
    const isMount = mounting.current;
    mounting.current = false;
    const { followed, setFollowed } = useListingStore.getState();
    const now = { pc: PC, listingCount };
    if (isMount && followed !== null) {
      setFollowed(now);
      return;
    }
    if (followed?.pc === PC && followed.listingCount === listingCount) return;
    const matches = listingsAt(useListingStore.getState().listings, PC);
    if (matches.length === 0) return;
    setFollowed(now);
    const shown = useListingStore.getState().activeFile;
    if (matches.some(listing => listing.filePath === shown)) return;
    setActiveFile(matches[0].filePath);
  }, [PC, listingCount, setActiveFile]);

  const listing = shownListing(listings, activeFile);
  const listingPath = listing?.filePath;
  const pcFiles = new Set(listingsAt(listings, PC).map(l => l.filePath));
  // Stable, so that the memoised rows are not all drawn again on every render.
  const onBreakpointToggle = useCallback(
    (index: number) => listingPath && toggleBreakpoint(listingPath, index),
    [listingPath, toggleBreakpoint],
  );

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <TabBar />
      {listings.length > 0 && (
        <div
          className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-gray-300 bg-gray-50 px-2 no-scrollbar"
          role="tablist"
          aria-label={t.listing.files}
        >
          {listings.map(l => {
            const name = l.filePath.split(/[/\\]/).pop()!;
            const active = l.filePath === listingPath;
            return (
              <button
                key={l.filePath}
                type="button"
                role="tab"
                aria-selected={active}
                className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded px-2 text-xs ${
                  active
                    ? 'bg-white font-semibold text-blue-700 shadow-[inset_0_0_0_1px_var(--color-gray-300)]'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
                title={l.filePath}
                onClick={() => setActiveFile(l.filePath)}
                data-listing-file={name}
              >
                <ScrollText className="size-3.5 shrink-0" aria-hidden />
                {name}
                {pcFiles.has(l.filePath) && (
                  <span
                    className="size-1.5 rounded-full bg-blue-600"
                    title={t.listing.pcHere}
                    aria-label={t.listing.pcHere}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
      <ListingTable
        filePath={listingPath ?? null}
        rows={listing?.rows ?? []}
        breakpoints={listing?.breakpoints ?? []}
        onBreakpointToggle={onBreakpointToggle}
      />
    </div>
  );
}
