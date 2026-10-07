// Marks on changed values: the memory viewer, the Watch and the Devices panel follow the same
// rules. A changed value flashes, then stays tinted and bold until the next step, as Visual
// Studio, Eclipse and JetBrains keep changed values marked until the next stop; bold, so that
// colour is not the only sign.

/**
 * How an update marks what changed:
 * - `step`: a step, a pause, a breakpoint or the end: every changed value flashes;
 * - `playing`: an instruction of a slow auto-play: a value that was already lit stays lit and
 *   its flash does not start over, so one that changes at every instruction does not strobe
 *   (AG Grid's rule; it also keeps the flashes under WCAG's three a second);
 * - `none`: a fast run's redraw: no marks (everything would flash all the time).
 */
export type MarkMode = 'step' | 'playing' | 'none';

/**
 * The marks after an update: each changed key with the number of the update whose flash it
 * shows. A view keys the marked element with that number, so a new number plays the flash
 * again and the same number leaves it be.
 */
export type ChangeMarks<K> = ReadonlyMap<K, number>;

export function nextMarks<K>(
  previous: ChangeMarks<K>,
  changed: Iterable<K>,
  update: number,
  mode: MarkMode,
): Map<K, number> {
  const marks = new Map<K, number>();
  if (mode === 'none') return marks;
  for (const key of changed) {
    marks.set(key, mode === 'playing' ? (previous.get(key) ?? update) : update);
  }
  return marks;
}

/** The classes of a marked value: the flash, then the tint; bold, so colour is not all. */
export const CHANGED_CLASSES = 'value-flash changed-tint font-semibold';
