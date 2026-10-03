import { useEffect, useRef } from 'react';
import type { ListingRow } from '@/api/types';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useRunningStore } from '@/features/debugger/runningStore';
import { hasObjectCode, rowAddress } from '@/features/listing/listingStore';

const COLUMNS: { title: string; className: string }[] = [
  { title: '', className: 'w-8' },
  { title: 'Address', className: 'w-24' },
  { title: 'Raw Hex', className: 'w-32' },
  { title: 'Label', className: 'w-24' },
  { title: 'Instruction', className: 'w-24' },
  { title: 'Operand', className: 'w-24' },
  { title: 'Comment', className: 'flex-1 min-w-64' },
  { title: 'Raw Code Binary', className: 'w-64' },
  { title: 'Instruction Binary', className: 'w-24' },
  { title: 'NIXBPE Flags', className: 'w-24' },
];

/** A purely numeric operand is shown as hex; labels and expressions are shown as written. */
function formatOperand(operand: string) {
  if (/^\d+$/.test(operand)) {
    return '0x' + parseInt(operand, 10).toString(16).toUpperCase().padStart(4, '0');
  }
  return operand;
}

interface ListingTableProps {
  rows: ListingRow[];
  /** Row indexes that have a breakpoint. */
  breakpoints: number[];
  onBreakpointToggle: (index: number) => void;
}

/** The assembly listing of one file, with the row at the PC highlighted. */
export default function ListingTable({ rows, breakpoints, onBreakpointToggle }: ListingTableProps) {
  const PC = useRegisterStore(state => state.PC);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

  // Keep the current row in view.
  useEffect(() => {
    if (highlightedRowRef.current && containerRef.current) {
      highlightedRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [PC, rows]);

  // Pause auto-play when the PC reaches a row with a breakpoint.
  useEffect(() => {
    const pcIndex = rows.findIndex(row => rowAddress(row) === PC);
    if (pcIndex !== -1 && breakpoints.includes(pcIndex)) {
      useRunningStore.getState().setIsPaused(true);
    }
  }, [PC, rows, breakpoints]);

  return (
    <div ref={containerRef} className="flex-1 p-4 bg-gray-100 overflow-auto font-mono text-sm">
      <div className="w-full overflow-x-auto">
        <table className="divide-y divide-gray-300 border-collapse">
          <thead>
            <tr className="whitespace-nowrap">
              {COLUMNS.map(column => (
                <th
                  key={column.title}
                  className={`px-2 py-2 text-left text-xs font-semibold text-gray-600 ${column.className}`}
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
                    <tr key={index} className="text-gray-500 italic whitespace-nowrap">
                      <td colSpan={COLUMNS.length} className="px-2 py-1">
                        {row.comment}
                      </td>
                    </tr>
                  );
                }
                const isCurrent = PC == rowAddress(row) && hasObjectCode(row);
                return (
                  <tr
                    key={index}
                    ref={isCurrent ? highlightedRowRef : null}
                    className={`whitespace-nowrap ${isCurrent ? 'bg-blue-100' : ''}`}
                  >
                    <td
                      className="px-2 py-1 cursor-pointer w-8"
                      onClick={() => onBreakpointToggle(index)}
                    >
                      {breakpoints.includes(index) ? (
                        <div className="w-2 h-2 rounded-full bg-red-500 mx-auto"></div>
                      ) : (
                        <div className="w-2 h-2 rounded-full border border-gray-400 mx-auto"></div>
                      )}
                    </td>
                    <td className="px-2 py-1 w-24">
                      {'0x' + rowAddress(row).toString(16).toUpperCase().padStart(6, '0')}
                    </td>
                    <td className="px-2 py-1 w-32">{row.rawCodeHex}</td>
                    <td className="px-2 py-1 w-24">{row.label}</td>
                    <td className="px-2 py-1 w-24">{row.instr}</td>
                    <td className="px-2 py-1 w-24">{formatOperand(row.operand)}</td>
                    <td className="px-2 py-1 flex-1 min-w-64">{row.comment}</td>
                    <td className="px-2 py-1 w-64">{row.rawCodeBinary}</td>
                    <td className="px-2 py-1 w-24">{row.instrBin}</td>
                    <td className="px-2 py-1 w-24">{row.nixbpe}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-8 text-gray-500">
                  No data to display.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
