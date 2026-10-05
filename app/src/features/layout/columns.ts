// Sizes of the three columns (files | editor | run panel) and of the bottom panel, in CSS px.
// The numbers come from the layout studies (documentations/08_layout): each minimum is the
// width below which the column's content no longer fits, each maximum the width past which
// the column only gains empty space.

export interface ColumnLimits {
  /** Below this the content no longer fits. */
  min: number;
  /** The width of a new installation (and after a double click on the divider). */
  default: number;
  /** Past this the column only gains empty space. */
  max: number;
  /** A side column never takes more than this share of the window. */
  maxShare: number;
}

export const FILES_COLUMN: ColumnLimits = { min: 180, default: 256, max: 560, maxShare: 0.4 };
/**
 * 296: the memory grid with 5-digit SIC/XE addresses (29ch + 1rem + 1px = 261 px), the panel's
 * padding and border (17 px), the memory viewer's scrollbar (8 px), and the column's own
 * scrollbar (8 px, on short or zoomed windows).
 */
export const DEBUG_COLUMN: ColumnLimits = { min: 296, default: 296, max: 480, maxShare: 0.4 };
/** The editor column keeps at least this width while the side columns are resized. */
export const EDITOR_MIN_WIDTH = 320;

export const BOTTOM_PANEL = { min: 40, default: 250 };
/** The editor keeps at least this height above the bottom panel. */
export const EDITOR_MIN_HEIGHT = 160;

export interface SideWidths {
  files: number;
  debug: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The largest width a side column may have in a row `total` px wide. */
export function maxWidth(limits: ColumnLimits, total: number) {
  return Math.max(limits.min, Math.min(limits.max, Math.floor(total * limits.maxShare)));
}

/**
 * The widths the side columns get in a row `total` px wide, given the widths the user chose.
 * Each stays within its limits; if the editor column would get less than EDITOR_MIN_WIDTH, the
 * side columns give up the difference in proportion to how far they are above their minimums.
 * The chosen widths themselves are kept, so the columns grow back when the window does.
 */
export function fitColumns(total: number, wanted: SideWidths): SideWidths & { editor: number } {
  let files = clamp(wanted.files, FILES_COLUMN.min, maxWidth(FILES_COLUMN, total));
  let debug = clamp(wanted.debug, DEBUG_COLUMN.min, maxWidth(DEBUG_COLUMN, total));
  const shortfall = files + debug + EDITOR_MIN_WIDTH - total;
  if (shortfall > 0) {
    const spareFiles = files - FILES_COLUMN.min;
    const spareDebug = debug - DEBUG_COLUMN.min;
    const spare = spareFiles + spareDebug;
    if (shortfall >= spare) {
      files = FILES_COLUMN.min;
      debug = DEBUG_COLUMN.min;
    } else {
      files -= Math.round((shortfall * spareFiles) / spare);
      debug -= shortfall - Math.round((shortfall * spareFiles) / spare);
    }
  }
  return { files, debug, editor: total - files - debug };
}

/** The range a side column can be dragged in, with the other side column at `other` px. */
export function dragRange(limits: ColumnLimits, total: number, other: number) {
  const max = Math.min(maxWidth(limits, total), total - other - EDITOR_MIN_WIDTH);
  return { min: limits.min, max: Math.max(limits.min, max) };
}

/** The bottom panel's height range in a middle column `total` px tall. */
export function panelRange(total: number) {
  return {
    min: BOTTOM_PANEL.min,
    max: Math.max(BOTTOM_PANEL.min, total - EDITOR_MIN_HEIGHT),
  };
}

export { clamp };
