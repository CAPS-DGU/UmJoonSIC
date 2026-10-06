// The memory viewer's grid: rows of an address and 8 bytes. Only the rows in
// `visibleRowRange` are rendered; each is positioned absolutely inside a container as tall as
// all rows. Sizes: gridLayout.ts.
import { CELL_CH, ROW_HEIGHT, ROW_SIZE } from '@/features/debugger/memory/gridLayout';

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
  cell: MemoryCellValue;
  labelHighlight?: boolean;
  isChanged?: boolean;
  isSearched?: boolean;
}

function MemoryCell({ cell, labelHighlight, isChanged, isSearched }: MemoryCellProps) {
  // The cell takes an eighth of the row; the byte keeps its 3 characters in the middle.
  return (
    <span className="flex justify-center">
      <span
        className={`w-[3ch] shrink-0 text-center rounded
      ${labelHighlight ? '!text-orange-800 font-semibold' : ''}
      ${isChanged ? 'memory-flash' : ''}
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
  changedNodes: ReadonlySet<number>;
  searchedNodes: ReadonlySet<number>;
}

/** The width of one cell: an eighth of the cells' area (the row minus its 0.5rem padding). */
const CELL = `((100% - 0.5rem) / ${ROW_SIZE})`;
/** How far a byte's 3 characters are from its cell's edges. */
const CELL_INSET = `((${CELL} - ${CELL_CH}ch) / 2)`;

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
      }));

    return (
      <div
        key={rowIndex}
        data-memory-row={rowStartAddr}
        className="absolute inset-x-0 flex"
        style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
      >
        <span
          className="shrink-0 whitespace-nowrap border-r border-gray-300 pr-2 text-right text-green-800"
          style={{ width: `calc(${digits}ch + 0.5rem + 1px)` }}
        >
          {rowStartAddr.toString(16).toUpperCase().padStart(digits, '0')}
        </span>
        <div className="relative grid h-5 flex-1 grid-cols-8 pl-2">
          {Array.from({ length: ROW_SIZE }, (_, column) => {
            const address = rowStartAddr + column;
            return (
              <MemoryCell
                key={column}
                cell={cellAt(address)}
                labelHighlight={rowLabels.some(l => column >= l.start && column <= l.end)}
                isChanged={changedNodes.has(address)}
                isSearched={searchedNodes.has(address)}
              />
            );
          })}

          {/* a line beneath each labelled range, and its name where the range starts */}
          {rowLabels.map((label, idx) => (
            <div
              key={idx}
              className="absolute top-full"
              // from the first byte's characters to the last's, a little inside them
              style={{
                left: `calc(0.5rem + ${label.start} * ${CELL} + ${CELL_INSET} + 0.25ch)`,
                width: `calc(${label.end - label.start + 1} * ${CELL} - 2 * ${CELL_INSET} - 0.5ch)`,
              }}
            >
              <div className="border-t-2 border-orange-600" />
              {label.beginsHere && (
                <div
                  // Near the right edge the name ends at the range's end instead of being
                  // centred under it (it was cut by the column: "ZER").
                  className={`whitespace-nowrap text-xs leading-[10px] text-orange-700 ${
                    label.start >= ROW_SIZE - 2 ? 'text-right' : 'text-center'
                  }`}
                  style={
                    label.start >= ROW_SIZE - 2 ? { position: 'absolute', right: 0 } : undefined
                  }
                  title={label.name}
                >
                  {label.name}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  });
}
