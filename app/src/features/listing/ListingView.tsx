import { useEffect } from 'react';
import path from 'path-browserify';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import TabBar from '@/features/editor/TabBar';
import ListingTable from '@/features/listing/ListingTable';
import { useListingStore } from '@/features/listing/listingStore';

/** The editor area while a "List: <file>" tab is active. */
export default function ListingView() {
  const { tabs, activeTabIdx, toggleBreakpoint, getActiveTab, setActiveTab } = useEditorTabStore();
  const { listings } = useListingStore();
  const activeTab = getActiveTab();
  const PC = useRegisterStore(state => state.PC);

  // Follow the PC across files: when it enters another file's code, switch to that file's List tab.
  useEffect(() => {
    if (!listings || listings.length === 0) return;

    // Listings that have an instruction (not a directive) at the PC
    const matches = listings.filter(file =>
      file.rows.some(
        r => parseInt(r.addressHex, 16) === PC && (r.rawCodeHex?.replaceAll(' ', '') || '') !== '',
      ),
    );
    if (matches.length === 0) return;

    // The tab already showing a matching listing stays.
    if (activeTab && activeTab.filePath.endsWith('.lst')) {
      const currentFile = activeTab.filePath.replace(/\.lst$/i, '');
      if (matches.some(m => m.filePath === currentFile)) return;
    }

    const targetTab = tabs.find(t => t.filePath === `${matches[0].filePath}.lst`);
    if (targetTab) {
      setActiveTab(targetTab.idx);
    }
    // Runs when the PC, the listings or the active tab index change, as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PC, listings, activeTabIdx]);

  const listingPath = path.join(activeTab?.filePath.replace('.lst', '') || '');
  const rows = listings.find(file => file.filePath === listingPath)?.rows ?? [];

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <TabBar />
      <ListingTable
        rows={rows}
        breakpoints={activeTab?.breakpoints ?? []}
        onBreakpointToggle={index => toggleBreakpoint(activeTab?.idx || 0, index)}
      />
    </div>
  );
}
