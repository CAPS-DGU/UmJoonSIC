/** A copy of `items` with the item at `from` moved to index `to` of the result (clamped). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return [...items];
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(Math.max(0, Math.min(to, result.length)), 0, item);
  return result;
}
