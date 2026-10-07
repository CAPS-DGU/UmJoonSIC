// The memory viewer's grid: rows of an address and 8 bytes. Only the rows in
// `visibleRowRange` are rendered; each is positioned absolutely inside a container as tall as
// all rows. Sizes: gridLayout.ts.
import {
  NAME_LINE,
  ROW_HEIGHT,
  ROW_SIZE,
  RULE_LINE,
  VALUE_LINE,
  namePlacements,
} from '@/features/debugger/memory/gridLayout';
import type { ChangeMarks } from '@/lib/changeMarks';

/** The three lines of a row: the bytes, the underline, the names. */
const GRID_ROWS = `${VALUE_LINE}px ${RULE_LINE}px ${NAME_LINE}px`;

/** What a cell shows: two hex digits, or 'ER' if reading the byte failed. */
export interface MemoryCellValue {
  value: string;
  /** Not read yet; a read is in progress. */
  isLoading?: boolean;
}

/** A named address range (a watched variable), underlined and labelled in the grid. */
export interface MemoryLabel {
  start: number;
  end: number;
  name: string;
}

interface RowRange {
  start: number;
  end: number;
}

function visibleRowIndexes(range: RowRange, totalRows: number) {
  const rows = [];
  for (let i = range.start; i < range.end; i++) {
    if (i < totalRows) rows.push(i);
  }
  return rows;
}

interface MemoryCellProps {
  address: number;
  column: number;
  cell: MemoryCellValue;
  labelHighlight?: boolean;
  isChanged?: boolean;
  isSearched?: boolean;
}

function MemoryCell({
  address,
  column,
  cell,
  labelHighlight,
  isChanged,
  isSearched,
}: MemoryCellProps) {
  // The cell takes an eighth of the row; the byte keeps its 3 characters in the middle.
  return (
    <span
      className="flex justify-center"
      style={{ gridRow: 1, gridColumn: column + 1 }}
      data-memory-address={address}
    >
      <span
        className={`w-[3ch] shrink-0 text-center rounded
      ${labelHighlight ? '!text-orange-800 font-semibold' : ''}
      ${isChanged ? 'memory-flash changed-tint font-semibold' : ''}
      ${isSearched ? 'search-flash' : ''}
      ${cell.isLoading ? 'bg-gray-200 animate-pulse' : ''}
      `}
      >
        {cell.value}
      </span>
    </span>
  );
}

interface MemoryRowsProps {
  totalRows: number;
  visibleRowRange: RowRange;
  /** Digits of an address (addressDigits). */
  digits: number;
  labels: MemoryLabel[];
  cellAt: (address: number) => MemoryCellValue;
  /** Changed cells, each with the update whose flash it shows: a new one draws the cell anew. */
  changedNodes: ChangeMarks<number>;
  searchedNodes: ReadonlySet<number>;
}

/** The rows on screen. Must sit in a monospace container as tall as all rows (relative). */
export function MemoryRows({
  totalRows,
  visibleRowRange,
  digits,
  labels,
  cellAt,
  changedNodes,
  searchedNodes,
}: MemoryRowsProps) {
  return visibleRowIndexes(visibleRowRange, totalRows).map(rowIndex => {
    const rowStartAddr = rowIndex * ROW_SIZE;
    const rowEndAddr = Math.min(rowStartAddr + ROW_SIZE - 1, totalRows * ROW_SIZE - 1);

    // Labels that touch this row, clipped to it and expressed as column indexes.
    const rowLabels = labels
      .filter(l => l.end >= rowStartAddr && l.start <= rowEndAddr)
      .map(l => ({
        name: l.name,
        start: Math.max(l.start, rowStartAddr) - rowStartAddr,
        end: Math.min(l.end, rowEndAddr) - rowStartAddr,
        /** The range begins on this row (its name is shown here). */
        beginsHere: l.start >= rowStartAddr,
      }))
      .sort((a, b) => a.start - b.start);

    const names = namePlacements(rowLabels);

    return (
      <div
        key={rowIndex}
        data-memory-row={rowStartAddr}
        className="absolute inset-x-0 flex"
        style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT, lineHeight: `${VALUE_LINE}px` }}
      >
        <span
          className="shrink-0 whitespace-nowrap border-r border-gray-300 pr-2 text-right text-green-800"
          style={{ width: `calc(${digits}ch + 0.5rem + 1px)` }}
        >
          {rowStartAddr.toString(16).toUpperCase().padStart(digits, '0')}
        </span>
        <div className="grid flex-1 grid-cols-8 pl-2" style={{ gridTemplateRows: GRID_ROWS }}>
          {Array.from({ length: ROW_SIZE }, (_, column) => {
            const address = rowStartAddr + column;
            return (
              <MemoryCell
                key={changedNodes.has(address) ? `${column}-${changedNodes.get(address)}` : column}
                address={address}
                column={column}
                cell={cellAt(address)}
                labelHighlight={rowLabels.some(l => column >= l.start && column <= l.end)}
                isChanged={changedNodes.has(address)}
                isSearched={searchedNodes.has(address)}
              />
            );
          })}

          {/* A line under each labelled range, from its first byte's digits to its last's.
              Grid items of the same columns as the bytes, so they line up at every width. */}
          {rowLabels.map(label => {
            const span = label.end - label.start + 1;
            return (
              <div
                key={`line-${label.start}`}
                data-memory-underline={label.name}
                className="h-0.5 self-start bg-orange-600"
                style={{
                  gridRow: 2,
                  gridColumn: `${label.start + 1} / span ${span}`,
                  // The digits are 2ch wide, centred in each cell (a cell is 100% / span).
                  marginInline: `calc(${50 / span}% - 1ch)`,
                }}
              />
            );
          })}

          {/* The names: see namePlacements. All in the row's whole width (one base for the
              percentages); each cut with "…" only if it cannot fit (the tooltip has it all). */}
          {names.map(({ label, left, maxWidth }) => (
            <div
              key={`name-${label.start}`}
              data-memory-label={label.name}
              // Clipped across only: in the 12 px line, the tails of g, p, y reach below it.
              className="min-w-0 justify-self-start [overflow-x:clip] [overflow-y:visible] text-ellipsis whitespace-nowrap text-xs text-orange-700"
              style={{
                gridRow: 3,
                gridColumn: `1 / ${ROW_SIZE + 1}`,
                lineHeight: `${NAME_LINE}px`,
                marginLeft: left,
                maxWidth,
              }}
              title={label.name}
            >
              {label.name}
            </div>
          ))}
        </div>
      </div>
    );
  });
}
