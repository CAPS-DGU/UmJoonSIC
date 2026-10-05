// Sizes of the memory viewer's grid. Widths are in `ch` (the width of a digit in the
// monospace font), so the grid is exactly as wide as its text, whatever the font and the
// number of address digits.

/** Bytes per row. */
export const ROW_SIZE = 8;
/** Row height in px: a line of bytes and, under it, the names of watched variables. */
export const ROW_HEIGHT = 32;
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
