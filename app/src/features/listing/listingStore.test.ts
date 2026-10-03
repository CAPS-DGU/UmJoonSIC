import { beforeEach, describe, expect, it } from 'vitest';
import type { ListingRow } from '@/api/types';
import {
  breakpointAt,
  listingOfTab,
  listingTabPath,
  useListingStore,
} from '@/features/listing/listingStore';

const row = (addressHex: string, instr: string, operand = ''): ListingRow => ({
  addressHex,
  rawCodeHex: '00',
  rawCodeBinary: '',
  label: '',
  instr,
  instrHex: '',
  instrBin: '',
  nixbpe: '',
  operand,
  comment: '',
  labelWidth: 0,
  nameWidth: 0,
  isCommentRow: false,
});

const ROWS = [
  row('000000', 'STL', 'RETADR'),
  row('000003', 'LDB', '#LENGTH'),
  row('000006', 'J', 'CLOOP'),
];

describe('listing store', () => {
  beforeEach(() => useListingStore.getState().forgetBreakpoints());

  it('finds a breakpoint by address, in any listing', () => {
    const { addListing, toggleBreakpoint } = useListingStore.getState();
    addListing('/p/main.asm', ROWS);
    addListing('/p/func.asm', [row('000020', 'LDA', '#1'), row('000023', 'RSUB')]);
    toggleBreakpoint('/p/main.asm', 1);
    toggleBreakpoint('/p/func.asm', 1);
    const { listings } = useListingStore.getState();
    expect(breakpointAt(listings, 0x03)).toBe(true);
    expect(breakpointAt(listings, 0x23)).toBe(true);
    expect(breakpointAt(listings, 0x06)).toBe(false);
  });

  it('keeps breakpoints for the next run of the same program', () => {
    const { addListing, toggleBreakpoint, clearListings } = useListingStore.getState();
    addListing('/p/main.asm', ROWS);
    toggleBreakpoint('/p/main.asm', 1);
    clearListings();
    addListing('/p/main.asm', ROWS);
    expect(useListingStore.getState().listings[0].breakpoints).toEqual([1]);
  });

  it('drops a breakpoint whose row changed, and all of them for another project', () => {
    const { addListing, toggleBreakpoint, clearListings, forgetBreakpoints } =
      useListingStore.getState();
    addListing('/p/main.asm', ROWS);
    toggleBreakpoint('/p/main.asm', 1);
    clearListings();
    addListing('/p/main.asm', [ROWS[0], row('000003', 'LDA', '#0'), ROWS[2]]);
    expect(useListingStore.getState().listings[0].breakpoints).toEqual([]);

    toggleBreakpoint('/p/main.asm', 2);
    forgetBreakpoints();
    addListing('/p/main.asm', ROWS);
    expect(useListingStore.getState().listings[0].breakpoints).toEqual([]);
  });

  it('maps a file to its listing tab and back', () => {
    useListingStore.getState().addListing('/p/main.asm', ROWS);
    const tabPath = listingTabPath('/p/main.asm');
    expect(tabPath).toBe('/p/main.asm.lst');
    expect(listingOfTab(useListingStore.getState().listings, tabPath)?.filePath).toBe(
      '/p/main.asm',
    );
  });
});
