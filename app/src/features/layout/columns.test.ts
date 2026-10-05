import { describe, expect, it } from 'vitest';
import {
  DEBUG_COLUMN,
  dragRange,
  EDITOR_MIN_WIDTH,
  FILES_COLUMN,
  fitColumns,
  maxWidth,
  panelRange,
} from '@/features/layout/columns';

describe('fitColumns', () => {
  it('gives the side columns the widths chosen when there is room', () => {
    expect(fitColumns(1280, { files: 300, debug: 320 })).toEqual({
      files: 300,
      debug: 320,
      editor: 660,
    });
  });

  it('keeps each side column within its limits', () => {
    const fit = fitColumns(1920, { files: 10, debug: 10_000 });
    expect(fit.files).toBe(FILES_COLUMN.min);
    expect(fit.debug).toBe(maxWidth(DEBUG_COLUMN, 1920));
  });

  it('caps a side column at its share of the window', () => {
    expect(fitColumns(1000, { files: 560, debug: DEBUG_COLUMN.min }).files).toBeLessThanOrEqual(
      400,
    );
  });

  it('shrinks the side columns, not the editor, until they reach their minimums', () => {
    const fit = fitColumns(800, { files: 400, debug: 400 });
    expect(fit.editor).toBe(EDITOR_MIN_WIDTH);
    expect(fit.files + fit.debug + fit.editor).toBe(800);
    expect(fit.files).toBeGreaterThanOrEqual(FILES_COLUMN.min);
    expect(fit.debug).toBeGreaterThanOrEqual(DEBUG_COLUMN.min);
  });

  it('shares the shortfall in proportion to the room above each minimum', () => {
    // 860 px: both caps are 344 px. 220 + 344 + 320 = 884, so 24 px must go: the room above
    // the minimums is 40 (files) and 48 (run panel), so they give up 11 and 13.
    const fit = fitColumns(860, { files: FILES_COLUMN.min + 40, debug: DEBUG_COLUMN.min + 48 });
    expect(fit).toEqual({
      files: FILES_COLUMN.min + 29,
      debug: DEBUG_COLUMN.min + 35,
      editor: EDITOR_MIN_WIDTH,
    });
  });

  it('stops at the minimums when even they do not fit', () => {
    const fit = fitColumns(600, { files: 300, debug: 300 });
    expect(fit).toEqual({
      files: FILES_COLUMN.min,
      debug: DEBUG_COLUMN.min,
      editor: 600 - FILES_COLUMN.min - DEBUG_COLUMN.min,
    });
  });
});

describe('dragRange', () => {
  it('leaves the editor its minimum width', () => {
    expect(dragRange(FILES_COLUMN, 1000, 300).max).toBe(1000 - 300 - EDITOR_MIN_WIDTH);
  });

  it('never goes below the minimum', () => {
    expect(dragRange(FILES_COLUMN, 700, 400)).toEqual({
      min: FILES_COLUMN.min,
      max: FILES_COLUMN.min,
    });
  });
});

describe('panelRange', () => {
  it('keeps the editor its minimum height', () => {
    expect(panelRange(600)).toEqual({ min: 40, max: 440 });
    expect(panelRange(100).max).toBe(40);
  });
});
