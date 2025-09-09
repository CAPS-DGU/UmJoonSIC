// src/components/editor/List.tsx
import React, { useEffect, useRef } from 'react';
import type { ListFileRow } from '@/stores/ListFileStore';
import { useRegisterStore } from '@/stores/RegisterStore';
import { useRunningStore } from '@/stores/RunningStore';

interface ListProps {
  data: ListFileRow[];
  activeTabTitle: string | undefined;
  breakpoints: number[];
  onBreakpointToggle: (index: number) => void;
}

export default function List({ data, activeTabTitle, breakpoints, onBreakpointToggle }: ListProps) {
  const { PC } = useRegisterStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

  // PC가 변경될 때마다 하이라이팅된 행으로 스크롤
  useEffect(() => {
    if (highlightedRowRef.current && containerRef.current) {
      highlightedRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [PC, data]);

  // PC가 변경될 때마다, 해당 PC 주소에 브레이크포인트가 있으면 stopRunning 호출
  useEffect(() => {
    // 현재 PC가 data에 존재하는지 확인
    const pcIndex = data.findIndex(row => parseInt(row.addressHex, 16) === PC);
    if (pcIndex !== -1 && breakpoints.includes(pcIndex)) {
      useRunningStore.getState().setIsPaused(true);
    }
  }, [PC, data, breakpoints]);


  // if (data.some(row => parseInt(row.addressHex, 16) === PC)) {
  //   console.log('PC is in data');
  // }

  const totalColumns = 10;
  return (
    <div ref={containerRef} className="flex-1 p-4 bg-gray-100 overflow-auto font-mono text-sm">
      <div className="w-full overflow-x-auto">
        <table className="divide-y divide-gray-300 border-collapse">
          <thead>
            <tr className="whitespace-nowrap">
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-8"></th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-24">
                Address
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-32">
                Raw Hex
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-24">
                Label
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-24">
                Instruction
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-24">
                Operand
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 flex-1 min-w-64">
                Comment
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-64">
                Raw Code Binary
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-24">
                Instruction Binary
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-24">
                NIXBPE Flags
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((row, index) => {
                if (row.isCommentRow) {
                  return (
                    <tr key={index} className="text-gray-500 italic whitespace-nowrap">
                      <td colSpan={totalColumns} className="px-2 py-1">
                        {row.comment}
                      </td>
                    </tr>
                  );
                }
                const isHighlighted =
                  PC == parseInt(row.addressHex, 16) && row.rawCodeHex.replaceAll(' ', '') != '';
                return (
                  <tr
                    key={index}
                    ref={isHighlighted ? highlightedRowRef : null}
                    className={`whitespace-nowrap ${isHighlighted ? 'bg-blue-100' : ''}`}
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
                      {'0x' +
                        parseInt(row.addressHex, 16).toString(16).toUpperCase().padStart(6, '0')}
                    </td>
                    <td className="px-2 py-1 w-32">{row.rawCodeHex}</td>
                    <td className="px-2 py-1 w-24">{row.label}</td>
                    <td className="px-2 py-1 w-24">{row.instr}</td>
                    <td className="px-2 py-1 w-24">
                      {(() => {
                        // if operand is number → Hexnum
                        if (/^\d+$/.test(row.operand)) {
                          return (
                            '0x' +
                            parseInt(row.operand, 10).toString(16).toUpperCase().padStart(4, '0')
                          );
                        }
                        // else (label etc) → print
                        return row.operand;
                      })()}
                    </td>
                    <td className="px-2 py-1 flex-1 min-w-64">{row.comment}</td>
                    <td className="px-2 py-1 w-64">{row.rawCodeBinary}</td>
                    <td className="px-2 py-1 w-24">{row.instrBin}</td>
                    <td className="px-2 py-1 w-24">{row.nixbpe}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={totalColumns} className="text-center py-8 text-gray-500">
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
