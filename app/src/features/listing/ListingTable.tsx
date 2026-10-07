import { CircleStop } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import type { ListingRow } from '@/api/types';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { formatAddress, useRunningStore } from '@/features/debugger/runningStore';
import { hasObjectCode, rowAddress, useListingStore } from '@/features/listing/listingStore';
import { showSourceOfRow, showSymbol } from '@/features/listing/navigate';
import { useStrings } from '@/i18n';
import { usePreferencesStore } from '@/stores/preferencesStore';

interface ListingTableProps {
  /** The source file the listing is of (as the simulator names it). */
  filePath: string | null;
  rows: ListingRow[];
  /** Row indexes that have a breakpoint. */
  breakpoints: number[];
  onBreakpointToggle: (index: number) => void;
}

interface RowProps {
  row: ListingRow;
  index: number;
  isCurrent: boolean;
  haltedHere: boolean;
  hasBreakpoint: boolean;
  onBreakpointToggle: (index: number) => void;
  breakpointTitle: string;
  haltedTitle: string;
  rowRef?: Ref<HTMLTableRowElement>;
  /** The row was asked for (a variable, an address): marked for a moment. */
  revealed: boolean;
  /** The operand names a symbol of the program: a link to its definition. */
  symbolOperand: boolean;
  onRowDoubleClick: (index: number) => void;
  onSymbolClick: (operand: string) => void;
  sourceTitle: string;
  symbolTitle: string;
}

/**
 * One instruction row. Memoised: when the PC moves, only the rows whose highlight changes are
 * drawn again (a fast run moves it many times a second through listings of 600 rows).
 */
const InstructionRow = memo(function InstructionRow({
  row,
  index,
  isCurrent,
  haltedHere,
  hasBreakpoint,
  onBreakpointToggle,
  breakpointTitle,
  haltedTitle,
  rowRef,
  revealed,
  symbolOperand,
  onRowDoubleClick,
  onSymbolClick,
  sourceTitle,
  symbolTitle,
}: RowProps) {
  return (
    <tr
      ref={rowRef}
      className={`group whitespace-nowrap ${haltedHere ? 'bg-red-100' : isCurrent ? 'bg-blue-100' : ''} ${
        revealed ? 'value-flash' : ''
      }`}
      title={haltedHere ? haltedTitle : sourceTitle}
      data-listing-row={index}
      onDoubleClick={() => onRowDoubleClick(index)}
    >
      <td
        className="px-2 py-1 cursor-pointer w-8"
        title={breakpointTitle}
        onClick={() => onBreakpointToggle(index)}
      >
        {haltedHere ? (
          <CircleStop className="mx-auto size-3.5 text-red-600" aria-label={haltedTitle} />
        ) : hasBreakpoint ? (
          <div className="w-2.5 h-2.5 rounded-full bg-red-600 mx-auto"></div>
        ) : (
          // The empty slot shows only on hover: a hollow circle on every row was noise.
          <div className="w-2.5 h-2.5 rounded-full border border-gray-400 mx-auto opacity-0 group-hover:opacity-100"></div>
        )}
      </td>
      <td className="px-2 py-1 w-24">
        {'0x' + rowAddress(row).toString(16).toUpperCase().padStart(6, '0')}
      </td>
      <td className="px-2 py-1 w-32">{row.rawCodeHex}</td>
      <td className="px-2 py-1 w-24">{row.label}</td>
      <td className="px-2 py-1 w-24">{row.instr}</td>
      {/* As the student wrote it (a decimal 0 was shown as 0x0000). A symbol is a link to its
          definition (and its bytes in memory). */}
      <td className="px-2 py-1 w-24">
        {symbolOperand ? (
          <button
            type="button"
            className="text-blue-700 underline decoration-dotted underline-offset-2 hover:decoration-solid"
            title={symbolTitle}
            onClick={e => {
              e.stopPropagation();
              onSymbolClick(row.operand);
            }}
            onDoubleClick={e => e.stopPropagation()}
          >
            {row.operand}
          </button>
        ) : (
          row.operand
        )}
      </td>
      <td className="px-2 py-1 flex-1 min-w-64">{row.comment}</td>
      <td className="px-2 py-1 w-64">{row.rawCodeBinary}</td>
      <td className="px-2 py-1 w-24">{row.instrBin}</td>
      <td className="px-2 py-1 w-24">{row.nixbpe}</td>
    </tr>
  );
});

/** The assembly listing of one file, with the row at the PC highlighted. */
export default function ListingTable({
  filePath,
  rows,
  breakpoints,
  onBreakpointToggle,
}: ListingTableProps) {
  const t = useStrings();
  const fontSize = usePreferencesStore(s => s.editorFontSize);
  const listings = useListingStore(s => s.listings);
  const revealRequest = useListingStore(s => s.revealRequest);
  const [revealedRow, setRevealedRow] = useState<number | null>(null);
  /** The program's symbols (labels of every listing), upper case. */
  const symbols = useMemo(
    () =>
      new Set(listings.flatMap(l => l.rows.map(r => r.label.trim().toUpperCase())).filter(Boolean)),
    [listings],
  );
  const symbolOf = (operand: string) =>
    operand
      .replace(/^[#@=+]/, '')
      .split(',')[0]
      .trim()
      .toUpperCase();
  const onRowDoubleClick = useCallback(
    (index: number) => filePath && void showSourceOfRow(filePath, index),
    [filePath],
  );
  const onSymbolClick = useCallback(
    (operand: string) => void showSymbol(operand, filePath ?? undefined),
    [filePath],
  );
  const PC = useRegisterStore(state => state.PC);
  const isHalted = useRunningStore(state => state.isHalted);
  // Only the end banner shows it: no redraw for every instruction while running.
  const stepCount = useRunningStore(state => (state.isHalted ? state.stepCount : 0));
  const COLUMNS: { title: string; className: string }[] = [
    { title: '', className: 'w-8' },
    { title: t.listing.address, className: 'w-24' },
    { title: t.listing.rawHex, className: 'w-32' },
    { title: t.listing.label, className: 'w-24' },
    { title: t.listing.instruction, className: 'w-24' },
    { title: t.listing.operand, className: 'w-24' },
    { title: t.listing.comment, className: 'flex-1 min-w-64' },
    { title: t.listing.rawBinary, className: 'w-64' },
    { title: t.listing.instructionBinary, className: 'w-24' },
    { title: t.listing.flags, className: 'w-24' },
  ];
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

  // A row asked for (a variable, an address, a symbol): scrolled to and marked for a moment.
  useEffect(() => {
    if (!revealRequest || revealRequest.filePath !== filePath) return;
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-listing-row="${revealRequest.rowIndex}"]`,
    );
    el?.scrollIntoView({ block: 'center' });
    setRevealedRow(revealRequest.rowIndex);
    const timer = setTimeout(() => setRevealedRow(null), 1500);
    return () => clearTimeout(timer);
  }, [revealRequest, filePath]);

  // Keep the current row in view.
  useEffect(() => {
    if (highlightedRowRef.current && containerRef.current) {
      // Smooth scrolling is for following a slow run; a fast one would animate without end.
      const fast =
        useRunningStore.getState().delayTime < 20 && !useRunningStore.getState().isPaused;
      highlightedRowRef.current.scrollIntoView({
        behavior: fast ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }, [PC, rows]);

  return (
    <div
      ref={containerRef}
      className="flex-1 p-4 bg-gray-100 overflow-auto font-mono"
      // The code font size of the preferences (the editor's), two px larger as before.
      style={{ fontSize: fontSize + 2 }}
    >
      {/* The program ended: say so next to the work, and leave everything as it is. */}
      {isHalted && (
        <div
          className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-gray-900"
          role="status"
        >
          <CircleStop className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
          <span>
            <span className="font-semibold">{t.state.halted(formatAddress(PC), stepCount)}</span>
            <span className="ml-2 text-gray-700">{t.state.haltedHint}</span>
          </span>
        </div>
      )}
      <div className="w-full overflow-x-auto">
        <table className="divide-y divide-gray-300 border-collapse">
          <thead>
            <tr className="whitespace-nowrap">
              {COLUMNS.map(column => (
                <th
                  key={column.title}
                  className={`px-2 py-2 text-left text-xs font-semibold text-gray-700 ${column.className}`}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.length > 0 ? (
              rows.map((row, index) => {
                if (row.isCommentRow) {
                  return (
                    <tr key={index} className="text-gray-600 italic whitespace-nowrap">
                      <td colSpan={COLUMNS.length} className="px-2 py-1">
                        {row.comment}
                      </td>
                    </tr>
                  );
                }
                const isCurrent = PC == rowAddress(row) && hasObjectCode(row);
                return (
                  <InstructionRow
                    key={index}
                    row={row}
                    index={index}
                    isCurrent={isCurrent}
                    haltedHere={isCurrent && isHalted}
                    hasBreakpoint={breakpoints.includes(index)}
                    onBreakpointToggle={onBreakpointToggle}
                    breakpointTitle={t.listing.breakpointTitle}
                    haltedTitle={t.listing.haltedHere}
                    rowRef={isCurrent ? highlightedRowRef : undefined}
                    revealed={revealedRow === index}
                    symbolOperand={symbols.has(symbolOf(row.operand))}
                    onRowDoubleClick={onRowDoubleClick}
                    onSymbolClick={onSymbolClick}
                    sourceTitle={t.listing.rowTitle}
                    symbolTitle={t.listing.symbolTitle}
                  />
                );
              })
            ) : (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-8 text-gray-600">
                  {t.listing.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
