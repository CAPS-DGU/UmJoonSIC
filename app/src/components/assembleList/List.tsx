// src/components/editor/List.tsx
import React from 'react';
import type { ListViewItem } from './ListContainer';
import { List as ListIcon } from 'lucide-react';
import { useRegisterStore } from '@/stores/RegisterStore';

interface ListProps {
  data: ListViewItem[];
  activeTabTitle: string | undefined;
  breakpoints: number[];
  onBreakpointToggle: (index: number) => void;
}

export default function List({ data, activeTabTitle, breakpoints, onBreakpointToggle }: ListProps) {
  const { PC } = useRegisterStore();


  const totalColumns = 10;
  return (
    <div className="flex-1 p-4 bg-gray-100 overflow-auto font-mono text-sm">
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
                return (
                  <tr
                    key={index}
                    className={`whitespace-nowrap ${PC == parseInt(row.addressHex, 16) ? 'bg-blue-100' : ''}`}
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
                    <td className="px-2 py-1 w-24">{row.addressHex}</td>
                    <td className="px-2 py-1 w-32">{row.rawCodeHex}</td>
                    <td className="px-2 py-1 w-24">{row.label}</td>
                    <td className="px-2 py-1 w-24">{row.instr}</td>
                    <td className="px-2 py-1 w-24">{row.operand}</td>
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
