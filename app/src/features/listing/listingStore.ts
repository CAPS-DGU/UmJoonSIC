import { create } from 'zustand';
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
  /** The file whose listing the List tab shows (its mini-tab). */
  activeFile: string | null;
  setActiveFile: (filePath: string) => void;
  /** A request to show a row (a variable, the PC, an address): the table scrolls to it. */
  revealRequest: { filePath: string; rowIndex: number; id: number } | null;
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

/**
 * The path of the one List tab of a run: its listings are mini-tabs inside it. It cannot be a
 * project file (a path does not start with ':'), and ends with .lst like a listing.
 */
export const LISTING_TAB = ':listing.lst';

/** The listing the List tab shows: the chosen one, else the first. */
export const shownListing = (listings: ListingFile[], activeFile: string | null) =>
  listings.find(listing => listing.filePath === activeFile) ?? listings[0];

/** Bytes of object code in a row. */
const rowSize = (row: ListingRow) => row.rawCodeHex.replaceAll(' ', '').length / 2;

/** The row whose object code holds `address` (code or data), in any listing. */
export function rowAtAddress(listings: ListingFile[], address: number) {
  for (const listing of listings) {
    const rowIndex = listing.rows.findIndex(
      row =>
        !row.isCommentRow &&
        rowSize(row) > 0 &&
        address >= rowAddress(row) &&
        address < rowAddress(row) + rowSize(row),
    );
    if (rowIndex >= 0) return { filePath: listing.filePath, rowIndex };
  }
  return null;
}

/** The row that defines `label` (in `filePath` first, then in any listing). */
export function rowDefining(listings: ListingFile[], label: string, filePath?: string) {
  const ordered = [...listings].sort(
    (a, b) => Number(b.filePath === filePath) - Number(a.filePath === filePath),
  );
  for (const listing of ordered) {
    const rowIndex = listing.rows.findIndex(
      row => !row.isCommentRow && row.label.toUpperCase() === label.toUpperCase(),
    );
    if (rowIndex >= 0) return { filePath: listing.filePath, rowIndex };
  }
  return null;
}

/** A piece of an operand: text, or a symbol of the program (a link to its definition). */
export interface OperandPart {
  text: string;
  symbol?: string;
}

/**
 * An operand cut into pieces, every symbol of the program a piece of its own: "PRTNUM,PUTCH"
 * gives two links, "BUFFER,X" one (X is a register), "#LIMIT" the link after "#". Character and
 * hex constants (C'EOF', X'F1') stay text, even when a label has the same name.
 */
export function operandParts(operand: string, isSymbol: (name: string) => boolean) {
  const parts: OperandPart[] = [];
  const pushText = (text: string) => {
    const last = parts.at(-1);
    if (last && last.symbol === undefined) last.text += text;
    else parts.push({ text });
  };
  for (const [token, constant, name] of operand.matchAll(
    /([CXcx]'[^']*')|([A-Za-z_]\w*)|[\s\S]/g,
  )) {
    if (constant === undefined && name !== undefined && isSymbol(name.toUpperCase())) {
      parts.push({ text: token, symbol: name.toUpperCase() });
    } else {
      pushText(token);
    }
  }
  return parts;
}

/** A source line's fields (label, operation, operand), as the listing has them. */
function lineFields(line: string) {
  if (/^\s*\./.test(line) || line.trim() === '') return null;
  const parts = line.trim().match(/[^\s']*'[^']*'[^\s]*|\S+/g) ?? [];
  const [label, instr, operand] = /^\s/.test(line) ? ['', parts[0], parts[1]] : parts;
  return [label ?? '', instr ?? '', operand ?? ''].map(f => f.toUpperCase()).join('|');
}
const rowFields = (row: ListingRow) =>
  [row.label, row.instr, row.operand].map(f => f.trim().toUpperCase()).join('|');

/**
 * The listing row of a source line (1-based), matched by its fields; a repeated line (two
 * "RSUB") is matched by its place among the same lines. Null for comments and blank lines.
 */
export function rowOfSourceLine(rows: ListingRow[], source: string, line: number) {
  const lines = source.split(/\r?\n/);
  const fields = lineFields(lines[line - 1] ?? '');
  if (!fields) return null;
  const nth = lines.slice(0, line - 1).filter(l => lineFields(l) === fields).length;
  let seen = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].isCommentRow || rowFields(rows[i]) !== fields) continue;
    if (seen++ === nth) return i;
  }
  return null;
}

/** The source line (1-based) of a listing row: the reverse of rowOfSourceLine. */
export function sourceLineOfRow(rows: ListingRow[], source: string, rowIndex: number) {
  const fields = rowFields(rows[rowIndex]);
  const nth = rows
    .slice(0, rowIndex)
    .filter(r => !r.isCommentRow && rowFields(r) === fields).length;
  const lines = source.split(/\r?\n/);
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lineFields(lines[i]) !== fields) continue;
    if (seen++ === nth) return i + 1;
  }
  return null;
}

export const useListingStore = create<ListingState>(set => ({
  listings: [],
  savedBreakpoints: new Map(),
  followed: null,
  activeFile: null,
  revealRequest: null,

  setFollowed: followed => set({ followed }),
  setActiveFile: activeFile => set({ activeFile }),

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

  clearListings: () => set({ listings: [], followed: null, activeFile: null, revealRequest: null }),
  forgetBreakpoints: () =>
    set({
      listings: [],
      savedBreakpoints: new Map(),
      followed: null,
      activeFile: null,
      revealRequest: null,
    }),
}));
