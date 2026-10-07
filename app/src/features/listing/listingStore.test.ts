import { beforeEach, describe, expect, it } from 'vitest';
import type { ListingRow } from '@/api/types';
import {
  breakpointAt,
  rowAtAddress,
  rowDefining,
  rowOfSourceLine,
  sourceLineOfRow,
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

  it('finds the row of an address, a label, and a source line (and back)', () => {
    const rows: ListingRow[] = [
      { ...row('000000', 'LDA', 'ONE'), rawCodeHex: '032003' },
      { ...row('000003', 'RSUB'), rawCodeHex: '4F0000' },
      { ...row('000006', 'RSUB'), rawCodeHex: '4F0000' },
      { ...row('000009', 'WORD', '1'), label: 'ONE', rawCodeHex: '000001' },
    ];
    useListingStore.getState().addListing('/p/main.asm', rows);
    const listings = useListingStore.getState().listings;
    expect(rowAtAddress(listings, 0x0a)).toEqual({ filePath: '/p/main.asm', rowIndex: 3 });
    expect(rowAtAddress(listings, 0x20)).toBeNull();
    expect(rowDefining(listings, 'one')).toEqual({ filePath: '/p/main.asm', rowIndex: 3 });
    const source = [
      '. a comment',
      'FIRST    LDA     ONE',
      '         RSUB',
      '         RSUB',
      'ONE      WORD    1',
    ].join('\n');
    // The listing has no label FIRST here; a line is matched by its operation and operand.
    expect(rowOfSourceLine(rows, source.replace('FIRST    LDA', '         LDA'), 2)).toBe(0);
    // A repeated line is matched by its place: the second RSUB.
    expect(rowOfSourceLine(rows, source, 4)).toBe(2);
    expect(sourceLineOfRow(rows, source, 2)).toBe(4);
    expect(rowOfSourceLine(rows, source, 1)).toBeNull();
  });
});
