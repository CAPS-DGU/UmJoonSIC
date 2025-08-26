import React, { useEffect, useState } from 'react';
import { useWatchStore } from '@/stores/pannel/WatchStore';
import type { WatchRow } from '@/stores/pannel/WatchStore';
import { ChevronDown, ChevronRight, Folder, FileText } from 'lucide-react';

const toHex = (value: number[]) => {
  if (!Array.isArray(value)) return '';
  return value.map(v => v.toString(16).toUpperCase().padStart(2, '0')).join(' ');
};

const toChar = (value: number[]) => {
  if (!Array.isArray(value)) return '';
  return value.map(v => {
    if (v < 32 || v > 126) {
      return '.';
    }
    return String.fromCharCode(v);
  }).join(' ');
};

interface GroupedWatchData {
  [filePath: string]: WatchRow[];
}

interface ExpandedState {
  [key: string]: boolean;
}

export default function WatchPannel() {
  const watch = useWatchStore(s => s.watch);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // 데이터를 파일별로 그룹화
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
      [key]: !prev[key]
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
          <td className="py-1 font-mono pl-8">
            <FileText className="inline w-3 h-3 mr-1" />
            {row.name}[{i}]
          </td>
          <td className="py-1 font-mono">{row.dataType}</td>
          <td className="py-1 font-mono">
            {'0x' + (row.address + i * row.elementSize).toString(16).toUpperCase()}
          </td>
          <td className="py-1 font-mono">
            {elementValue.length > 0 ? parseInt(toHex(elementValue).replaceAll(' ', ''), 16) : ''}
          </td>
          <td className="py-1 font-mono">{toHex(elementValue)}</td>
          <td className="py-1 font-mono">{toChar(elementValue)}</td>
        </tr>
      );
    }
    return elements;
  };

  return (
    <div className="p-4 text-black dark:text-white h-full font-sans">
      <h2 className="text-xl font-bold mb-3">Watch</h2>
      <div className="overflow-auto">
        <table className="w-full text-sm table-fixed border-collapse">
          <thead className="text-left text-gray-500 dark:text-gray-400">
            <tr>
              <th className="py-2 font-semibold w-1/3">Name</th>
              <th className="py-2 font-semibold w-1/4">Type</th>
              <th className="py-2 font-semibold w-1/3">Address</th>
              <th className="py-2 font-semibold w-1/4">DEC</th>
              <th className="py-2 font-semibold w-1/4">HEX</th>
              <th className="py-2 font-semibold w-1/4">CHAR</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedData).map(([filePath, rows]) => {
              const fileKey = filePath;
              const isFileExpanded = expanded[fileKey];
              
              return (
                <React.Fragment key={filePath}>
                  {/* 파일 헤더 */}
                  <tr 
                    className="hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => toggleExpanded(fileKey)}
                  >
                    <td colSpan={6} className="py-1 font-semibold">
                      {isFileExpanded ? (
                        <ChevronDown className="inline w-4 h-4 mr-1" />
                      ) : (
                        <ChevronRight className="inline w-4 h-4 mr-1" />
                      )}
                      <Folder className="inline w-4 h-4 mr-1" />
                      {filePath.split('/').pop()}
                    </td>
                  </tr>
                  
                  {/* 파일 내용 */}
                  {isFileExpanded && rows.map(row => {
                    const arrayKey = `${filePath}-${row.name}`;
                    const isArrayExpanded = expanded[arrayKey];
                    const isArray = row.elementCount > 1;
                    
                    return (
                      <React.Fragment key={row.name}>
                        {/* 메인 변수 행 */}
                        <tr className="hover:bg-gray-200 dark:hover:bg-gray-800">
                          <td className="py-1 font-mono pl-4">
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
                          <td className="py-1 font-mono">{row.dataType}</td>
                          <td className="py-1 font-mono">
                            {'0x' + row.address.toString(16).toUpperCase().padStart(6, '0')}
                          </td>
                          <td className="py-1 font-mono">
                            {row.value && row.value.length > 0 
                              ? parseInt(toHex(row.value).replaceAll(' ', ''), 16) 
                              : ''}
                          </td>
                          <td className="py-1 font-mono">{toHex(row.value ?? [])}</td>
                          <td className="py-1 font-mono">{toChar(row.value ?? [])}</td>
                        </tr>
                        
                        {/* 배열 요소들 */}
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
