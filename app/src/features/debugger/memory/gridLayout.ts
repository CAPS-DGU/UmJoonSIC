// Sizes of the memory viewer's grid. Widths are in `ch` (the width of a digit in the
// monospace font), so the grid is exactly as wide as its text, whatever the font and the
// number of address digits.

/** Bytes per row. */
export const ROW_SIZE = 8;
/**
 * A row's three lines, in px: the bytes (14 px digits), the underline of a watched variable
 * (2 px, at the top of its line), and the variable's name (12 px). Measured at every width of
 * the run panel (296 to 480 px): the digits' ink ends about 3.5 px above
 * the underline, the name's ink starts about 2.5 px below it, and ends above the next row's
 * digits. The bytes had 20 px and the names 10 px, so names overlapped the underline.
 */
export const VALUE_LINE = 17;
export const RULE_LINE = 3;
export const NAME_LINE = 12;
/** Row height in px: the three lines above. */
export const ROW_HEIGHT = VALUE_LINE + RULE_LINE + NAME_LINE;
/** Width of one byte cell: two digits and one digit of space. */
export const CELL_CH = 3;

/** Digits of an address in a memory of `size` bytes (at least 4). */
export function addressDigits(size: number) {
  return Math.max(4, (size - 1).toString(16).length);
}

/**
 * The grid's smallest width: the address, a gap of 0.5rem on each side of the dividing line,
 * and 8 cells of 3 characters. Wider, the cells share the space (the bytes spread out). The
 * panel's minimum width is measured with the widest case (5 digits, SIC/XE).
 */
export function gridWidth(digits: number) {
  return `calc(${digits + ROW_SIZE * CELL_CH}ch + 1rem + 1px)`;
}

export interface RowLabel {
  name: string;
  /** First and last column of the range on this row. */
  start: number;
  end: number;
  /** The range begins on this row (its name is shown here). */
  beginsHere: boolean;
}

/**
 * Where the names of a row go, as CSS lengths in the row's cells area (100% = 8 columns; in
 * the names' 12 px font, 1ch is one letter and 0.7em one 14 px digit):
 *   - a name starts under its first byte's digits;
 *   - it ends before the next range of the row (it never reaches under another variable's
 *     first byte), else it moves left, as far as it must to fit;
 *   - moving left, it may cross unlabelled columns, but at most one letter into the previous
 *     variable's bytes, and it stops one letter after the previous name: a name stays by its
 *     own bytes and never touches another.
 * A name that still does not fit is cut with "…" at the next range. Before 2026-10-07 a name
 * could move left only over unlabelled columns, so a short name in the last column of a narrow
 * panel (ZERO at 296 px) was cut although it needed 4 px.
 */
export function namePlacements(rowLabels: RowLabel[]) {
  const column = (n: number) => `${(n * 100) / ROW_SIZE}%`;
  const placed: { label: RowLabel; left: string; maxWidth: string }[] = [];
  let previousEnd = '0px';
  for (const label of rowLabels) {
    if (!label.beginsHere) continue;
    const next = rowLabels.find(l => l.start > label.start);
    const areaEnd = column(next ? next.start : ROW_SIZE);
    const len = `${label.name.length}ch`;
    const underDigits = `calc(${column(label.start + 0.5)} - 0.7em)`;
    const fitsBeforeEnd = `calc(${areaEnd} - ${len} - 2px)`;
    const before = [...rowLabels].reverse().find(l => l.start < label.start);
    const pastBefore = before
      ? `calc(${column(Math.min(before.end + 1, label.start))} - 1ch)`
      : '0px';
    const left = `max(${previousEnd}, ${pastBefore}, min(${underDigits}, ${fitsBeforeEnd}))`;
    placed.push({ label, left, maxWidth: `calc(${areaEnd} - ${left})` });
    // The next name stays one letter after this one's end (or its cut end).
    previousEnd = `calc(min(${left} + ${len}, ${areaEnd}) + 1ch)`;
  }
  return placed;
}
