import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode } from 'lucide-react';
import { useWatchStore, watchKey } from '@/features/panel/watchStore';
import type { WatchRow } from '@/features/panel/watchStore';
import { hexAddress, toChar, toDecimal, toHex } from '@/features/panel/watchFormat';
import { useStrings } from '@/i18n';
import { CHANGED_CLASSES } from '@/lib/changeMarks';

export default function WatchPanel() {
  const t = useStrings();
  const watch = useWatchStore(s => s.watch);
  const changed = useWatchStore(s => s.changed);
  // A changed value flashes, then stays tinted until the next step (lib/changeMarks); a row
  // keyed with its mark is drawn anew when the mark is new, so the flash plays again.

  /** The mark of the bytes in [from, to) of this variable that changed (the latest), if any. */
  const markIn = (row: WatchRow, from: number, to: number) => {
    let mark: number | null = null;
    for (const [offset, update] of changed.get(watchKey(row)) ?? []) {
      if (offset >= from && offset < to) mark = Math.max(mark ?? 0, update);
    }
    return mark;
  };
  const flash = (mark: number | null) => (mark === null ? '' : ` ${CHANGED_CLASSES}`);
  // Files and arrays: files are open unless closed, arrays closed unless opened.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  // Rows grouped by source file, in address order (the order of the source).
  const groupedData = useMemo(() => {
    const groups: Record<string, WatchRow[]> = {};
    for (const row of watch) (groups[row.filePath] ??= []).push(row);
    Object.values(groups).forEach(rows => rows.sort((a, b) => a.address - b.address));
    return groups;
  }, [watch]);

  const toggle = (key: string) => setToggled(prev => ({ ...prev, [key]: !prev[key] }));
  // pr-3: a cut-off HEX value ('48 45 4C …') ran straight into the CHAR text.
  const cell = 'py-1 pr-3 font-mono truncate';

  const renderArrayElements = (row: WatchRow) => {
    if (row.elementCount <= 1) return null;
    const elements = [];
    for (let i = 0; i < row.elementCount; i++) {
      const startIndex = i * row.elementSize;
      const elementValue = row.value?.slice(startIndex, startIndex + row.elementSize) || [];
      const elementMark = markIn(row, startIndex, startIndex + row.elementSize);
      const elementFlash = flash(elementMark);
      elements.push(
        <tr key={`${row.name}[${i}]@${elementMark ?? ''}`} className="hover:bg-gray-200">
          <td className={`${cell} pl-10`}>
            {row.name}[{i}]
          </td>
          <td className={cell}>{row.dataType}</td>
          <td className={cell}>{hexAddress(row.address + i * row.elementSize)}</td>
          <td className={cell + elementFlash}>{toDecimal(elementValue)}</td>
          <td className={cell + elementFlash}>{toHex(elementValue)}</td>
          <td className={cell + elementFlash}>{toChar(elementValue)}</td>
        </tr>,
      );
    }
    return elements;
  };

  if (watch.length === 0) {
    return <p className="p-4 text-sm text-gray-600">{t.panel.watchEmpty}</p>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden text-gray-900">
      {/* Narrower than the table's minimum, the table scrolls instead of overlapping. */}
      <div className="slim-scroll flex-1 overflow-auto p-2">
        <table className="w-full min-w-[36rem] text-sm table-fixed border-collapse">
          <thead className="text-left text-gray-700">
            <tr>
              <th className="py-2 font-semibold w-[22%]">{t.panel.watchName}</th>
              <th className="py-2 font-semibold w-[12%]">{t.panel.watchType}</th>
              <th className="py-2 font-semibold w-[16%]">{t.panel.watchAddress}</th>
              <th className="py-2 font-semibold w-[16%]">{t.panel.watchDec}</th>
              <th className="py-2 font-semibold w-[18%]">{t.panel.watchHex}</th>
              <th className="py-2 font-semibold w-[16%]">{t.panel.watchChar}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedData).map(([filePath, rows]) => {
              const isFileExpanded = !toggled[filePath];
              return (
                <React.Fragment key={filePath}>
                  <tr className="hover:bg-gray-200 cursor-pointer" onClick={() => toggle(filePath)}>
                    <td colSpan={6} className="py-1">
                      <div className="flex items-center gap-1 font-semibold">
                        {isFileExpanded ? (
                          <ChevronDown className="w-4 h-4 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        )}
                        <FileCode className="w-4 h-4 shrink-0 text-green-700" />
                        <span className="min-w-0 truncate">{filePath.split('/').pop()}</span>
                      </div>
                    </td>
                  </tr>
                  {isFileExpanded &&
                    rows.map(row => {
                      const arrayKey = `${filePath}-${row.name}`;
                      const isArray = row.elementCount > 1;
                      const isArrayExpanded = !!toggled[arrayKey];
                      const rowMark = markIn(row, 0, Infinity);
                      const rowFlash = flash(rowMark);
                      return (
                        <React.Fragment key={row.name}>
                          <tr key={`row@${rowMark ?? ''}`} className="hover:bg-gray-200">
                            <td className={`${cell} pl-5`} title={row.name}>
                              {isArray ? (
                                <button
                                  type="button"
                                  className="mr-1"
                                  onClick={() => toggle(arrayKey)}
                                >
                                  {isArrayExpanded ? (
                                    <ChevronDown className="inline w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="inline w-3 h-3" />
                                  )}
                                </button>
                              ) : (
                                <span className="mr-1 inline-block w-3" />
                              )}
                              {row.name}
                            </td>
                            <td className={cell}>{row.dataType}</td>
                            <td className={cell}>{hexAddress(row.address)}</td>
                            <td className={cell + rowFlash}>
                              {isArray ? '' : toDecimal(row.value ?? [])}
                            </td>
                            <td className={cell + rowFlash} title={toHex(row.value ?? [])}>
                              {toHex(row.value ?? [])}
                            </td>
                            <td className={cell + rowFlash} title={toChar(row.value ?? [])}>
                              {toChar(row.value ?? [])}
                            </td>
                          </tr>
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
