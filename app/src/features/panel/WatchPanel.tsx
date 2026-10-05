import React, { useState } from 'react';
import { useWatchStore } from '@/features/panel/watchStore';
import type { WatchRow } from '@/features/panel/watchStore';
import { ChevronDown, ChevronRight, Folder, FileText } from 'lucide-react';
import { PANEL_HEADER } from '@/lib/controls';

const toHex = (value: number[]) => {
  if (!Array.isArray(value)) return '';
  return value.map(v => v.toString(16).toUpperCase().padStart(2, '0')).join(' ');
};

const toChar = (value: number[]) => {
  if (!Array.isArray(value)) return '';
  return value
    .map(v => {
      if (v < 32 || v > 126) {
        return '.';
      }
      return String.fromCharCode(v);
    })
    .join(' ');
};

interface GroupedWatchData {
  [filePath: string]: WatchRow[];
}

interface ExpandedState {
  [key: string]: boolean;
}

export default function WatchPanel() {
  const watch = useWatchStore(s => s.watch);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Rows grouped by source file.
  const groupedData: GroupedWatchData = watch.reduce((acc, row) => {
    if (!acc[row.filePath]) {
      acc[row.filePath] = [];
    }
    acc[row.filePath].push(row);
    return acc;
  }, {} as GroupedWatchData);

  const toggleExpanded = (key: string) => {
    setExpanded(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const renderArrayElements = (row: WatchRow) => {
    if (row.elementCount <= 1) return null;

    const elements = [];
    for (let i = 0; i < row.elementCount; i++) {
      const startIndex = i * row.elementSize;
      const endIndex = startIndex + row.elementSize;
      const elementValue = row.value?.slice(startIndex, endIndex) || [];

      elements.push(
        <tr key={`${row.name}[${i}]`} className="hover:bg-gray-100 dark:hover:bg-gray-800">
          <td className="py-1 font-mono pl-8 truncate">
            <FileText className="inline w-3 h-3 mr-1" />
            {row.name}[{i}]
          </td>
          <td className="py-1 font-mono truncate">{row.dataType}</td>
          <td className="py-1 font-mono truncate">
            {'0x' + (row.address + i * row.elementSize).toString(16).toUpperCase().padStart(6, '0')}
          </td>
          <td className="py-1 font-mono truncate">
            {elementValue.length > 0 ? parseInt(toHex(elementValue).replaceAll(' ', ''), 16) : ''}
          </td>
          <td className="py-1 font-mono truncate">{toHex(elementValue)}</td>
          <td className="py-1 font-mono truncate">{toChar(elementValue)}</td>
        </tr>,
      );
    }
    return elements;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden text-black dark:text-white">
      <div className={PANEL_HEADER}>
        <span className="font-semibold text-sm">Watch</span>
      </div>
      {/* Narrower than the table's minimum, the table scrolls instead of overlapping. */}
      <div className="slim-scroll flex-1 overflow-auto p-2">
        <table className="w-full min-w-[36rem] text-sm table-fixed border-collapse">
          <thead className="text-left text-gray-500 dark:text-gray-400">
            <tr>
              <th className="py-2 font-semibold w-[22%]">Name</th>
              <th className="py-2 font-semibold w-[12%]">Type</th>
              <th className="py-2 font-semibold w-[16%]">Address</th>
              <th className="py-2 font-semibold w-[18%]">DEC</th>
              <th className="py-2 font-semibold w-[18%]">HEX</th>
              <th className="py-2 font-semibold w-[14%]">CHAR</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedData).map(([filePath, rows]) => {
              const fileKey = filePath;
              const isFileExpanded = expanded[fileKey];

              return (
                <React.Fragment key={filePath}>
                  {/* the file's row */}
                  <tr
                    className="hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => toggleExpanded(fileKey)}
                  >
                    <td colSpan={6} className="py-1">
                      <div className="flex items-center gap-1 font-semibold">
                        {isFileExpanded ? (
                          <ChevronDown className="w-4 h-4 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        )}
                        <Folder className="w-4 h-4 shrink-0" />
                        <span className="min-w-0 truncate">{filePath.split('/').pop()}</span>
                      </div>
                    </td>
                  </tr>

                  {/* its variables */}
                  {isFileExpanded &&
                    rows.map(row => {
                      const arrayKey = `${filePath}-${row.name}`;
                      const isArrayExpanded = expanded[arrayKey];
                      const isArray = row.elementCount > 1;

                      return (
                        <React.Fragment key={row.name}>
                          {/* a variable */}
                          <tr className="hover:bg-gray-200 dark:hover:bg-gray-800">
                            <td className="py-1 font-mono pl-4 truncate">
                              {isArray && (
                                <span
                                  className="cursor-pointer mr-1"
                                  onClick={() => toggleExpanded(arrayKey)}
                                >
                                  {isArrayExpanded ? (
                                    <ChevronDown className="inline w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="inline w-3 h-3" />
                                  )}
                                </span>
                              )}
                              <FileText className="inline w-3 h-3 mr-1" />
                              {row.name} ({row.dataType.toUpperCase()})
                            </td>
                            <td className="py-1 font-mono truncate">{row.dataType}</td>
                            <td className="py-1 font-mono truncate">
                              {'0x' + row.address.toString(16).toUpperCase().padStart(6, '0')}
                            </td>
                            <td className="py-1 font-mono truncate">
                              {row.value && row.value.length > 0
                                ? parseInt(toHex(row.value).replaceAll(' ', ''), 16)
                                : ''}
                            </td>
                            <td className="py-1 font-mono truncate">{toHex(row.value ?? [])}</td>
                            <td className="py-1 font-mono truncate">{toChar(row.value ?? [])}</td>
                          </tr>

                          {/* the elements of an array */}
                          {isArray && isArrayExpanded && renderArrayElements(row)}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
