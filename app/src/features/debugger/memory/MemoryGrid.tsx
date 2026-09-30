// The memory viewer's grid: an address column and rows of bytes. Only the rows in
// `visibleRowRange` are rendered; each is positioned absolutely inside a tall container.
import type { MemoryNodeData } from '@/features/debugger/memory/memoryViewStore';

/** Bytes per row. */
export const ROW_SIZE = 8;
/** Row height in px. */
export const ROW_HEIGHT = 32;
/** Width of one byte cell in px (w-6). */
const CELL_WIDTH = 24;

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

const STATUS_CLASSES = {
  normal: '',
  highlighted: 'bg-yellow-200',
  'red bold': 'text-red-500 font-bold',
};

interface MemoryCellProps {
  node: MemoryNodeData | null;
  labelHighlight?: boolean;
  isChanged?: boolean;
  isSearched?: boolean;
}

function MemoryCell({ node, labelHighlight, isChanged, isSearched }: MemoryCellProps) {
  const value = node?.value || '00';
  const status = node?.status || 'normal';

  return (
    <span
      className={`font-mono text-sm px-1 w-6 text-center rounded
      ${STATUS_CLASSES[status]}
      ${labelHighlight ? '!text-orange-500 font-semibold' : ''}
      ${isChanged ? 'memory-flash' : ''}
      ${isSearched ? 'search-flash' : ''}
      ${node?.isLoading ? 'bg-gray-200 animate-pulse' : ''}
      `}
    >
      {value}
    </span>
  );
}

interface AddressColumnProps {
  totalRows: number;
  visibleRowRange: RowRange;
}

export function AddressColumn({ totalRows, visibleRowRange }: AddressColumnProps) {
  return (
    <div className="flex flex-col gap-2 pr-4 relative">
      {visibleRowIndexes(visibleRowRange, totalRows).map(rowIndex => (
        <p
          key={rowIndex}
          className="text-sm font-normal font-mono flex items-center"
          style={{
            height: `${ROW_HEIGHT}px`,
            position: 'absolute',
            top: `${rowIndex * ROW_HEIGHT - 6}px`,
            right: `-15px`,
          }}
        >
          {(rowIndex * ROW_SIZE).toString(16).toUpperCase().padStart(4, '0')}
        </p>
      ))}
    </div>
  );
}

interface ValueColumnProps {
  totalRows: number;
  visibleRowRange: RowRange;
  labels: MemoryLabel[];
  memoryValues: (MemoryNodeData | null)[];
  changedNodes: Set<number>;
  searchedNodes: Set<number>;
}

export function ValueColumn({
  totalRows,
  visibleRowRange,
  labels,
  memoryValues,
  changedNodes,
  searchedNodes,
}: ValueColumnProps) {
  return (
    <div className="flex flex-col gap-2 pl-4 relative">
      {visibleRowIndexes(visibleRowRange, totalRows).map(rowIndex => {
        const rowStartAddr = rowIndex * ROW_SIZE;
        const rowEndAddr = Math.min(rowStartAddr + ROW_SIZE - 1, totalRows * ROW_SIZE - 1);

        // Labels that touch this row, clipped to it and expressed as column indexes.
        const rowLabels = labels
          .filter(l => l.end >= rowStartAddr && l.start <= rowEndAddr)
          .map(l => ({
            ...l,
            start: Math.max(l.start, rowStartAddr) - rowStartAddr,
            end: Math.min(l.end, rowEndAddr) - rowStartAddr,
          }));

        return (
          <div
            key={rowIndex}
            className="flex flex-col space-y-1 relative"
            style={{
              height: `${ROW_HEIGHT}px`,
              position: 'absolute',
              top: `${rowIndex * ROW_HEIGHT}px`,
            }}
          >
            <div className="flex relative mb-2">
              {Array.from({ length: ROW_SIZE }, (_, column) => {
                const address = rowStartAddr + column;
                return (
                  <MemoryCell
                    key={column}
                    node={memoryValues[address]}
                    labelHighlight={rowLabels.some(l => column >= l.start && column <= l.end)}
                    isChanged={changedNodes.has(address)}
                    isSearched={searchedNodes.has(address)}
                  />
                );
              })}

              {/* underline beneath each labelled range */}
              {rowLabels.map((label, idx) => {
                const originalLabel = labels.find(l => l.name === label.name);
                if (!originalLabel) return null;

                const relativeStart = Math.max(originalLabel.start, rowStartAddr) - rowStartAddr;
                const width =
                  (Math.min(originalLabel.end, rowEndAddr) - rowStartAddr - relativeStart + 1) *
                    CELL_WIDTH -
                  8;

                return (
                  <div
                    key={`line-${idx}`}
                    className="absolute -bottom-0.5 border-t-2 border-orange-500"
                    style={{ left: relativeStart * CELL_WIDTH + 4, width }}
                  />
                );
              })}

              {/* the name, only on the row where the range starts */}
              {rowLabels
                .filter(label => {
                  const originalLabel = labels.find(l => l.name === label.name);
                  if (!originalLabel) return false;
                  return Math.floor(originalLabel.start / ROW_SIZE) === rowIndex;
                })
                .map((label, idx) => (
                  <div
                    key={`name-${idx}`}
                    className="absolute -bottom-4 text-xs text-orange-500 text-center font-mono"
                    style={{
                      left: label.start * CELL_WIDTH + 4,
                      width: (label.end - label.start + 1) * CELL_WIDTH - 8,
                    }}
                  >
                    {label.name}
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
