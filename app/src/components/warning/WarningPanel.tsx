// src/components/WarningPanel.tsx

import React, { useState } from 'react';
import { File, ChevronRight, AlertTriangle, Settings, List } from 'lucide-react';

// 경고 메시지 타입 정의
interface WarningMessage {
  file: string;
  message: string;
  line?: number;
}

// 더미 데이터: SIC/XE 어셈블러 경고 목록
const dummyWarnings: WarningMessage[] = [
  {
    file: 'project.sic',
    message: "Undefined symbol 'MY_VAR'. Please define this variable.",
    line: 52,
  },
  {
    file: 'project.sic',
    message: "Invalid opcode 'LDBB'. Did you mean 'LDB'?",
    line: 78,
  },
  {
    file: 'project.sic',
    message: "Duplicate label 'LOOP_START'. This label is already defined at line 15.",
    line: 101,
  },
  {
    file: 'project.sic',
    message: 'Operand format mismatch. Expected a register but received a constant.',
    line: 125,
  },
  {
    file: 'test.lst',
    message: 'Warning: Unreachable code detected after HLT instruction.',
    line: 35,
  },
  {
    file: 'test.lst',
    message: 'Expression evaluates to zero. Check for potential logic errors.',
    line: 42,
  },
  {
    file: 'dummy-file.txt',
    message: 'File is not a valid SIC/XE source file. Please use a .sic or .asm extension.',
    line: undefined,
  },
];

// 파일별 경고를 그룹화하는 함수
const groupWarningsByFile = (warnings: WarningMessage[]) => {
  return warnings.reduce(
    (acc, warning) => {
      if (!acc[warning.file]) {
        acc[warning.file] = [];
      }
      acc[warning.file].push(warning);
      return acc;
    },
    {} as Record<string, WarningMessage[]>,
  );
};

// Helper Function -> gets icon depends on file type
const getFileIcon = (fileName: string) => {
  if (fileName === 'project.sic') {
    return <Settings className="text-gray-500 mr-2 w-4 h-4" />;
  }
  if (fileName.toLowerCase().endsWith('.lst')) {
    return <List className="text-gray-500 mr-2 w-4 h-4" />;
  }
  return <File className="text-gray-500 mr-2 w-4 h-4" />;
};

const WarningPanel = () => {
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());
  const groupedWarnings = groupWarningsByFile(dummyWarnings);
  const fileNames = Object.keys(groupedWarnings);
  const totalWarningCount = dummyWarnings.length;

  const toggleFile = (fileName: string) => {
    setOpenFiles(prevOpenFiles => {
      const newOpenFiles = new Set(prevOpenFiles);
      if (newOpenFiles.has(fileName)) {
        newOpenFiles.delete(fileName);
      } else {
        newOpenFiles.add(fileName);
      }
      return newOpenFiles;
    });
  };

  return (
    <div className="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col h-full overflow-hidden">
      {/* Pannel Header */}
      <div className="flex items-center p-2 border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-center">
          <AlertTriangle className="text-yellow-500 mr-1 w-4 h-4" />
          <span className="font-semibold text-sm">Warnings</span>
        </div>
        <div className="ml-auto flex items-center">
          <AlertTriangle className="text-yellow-500 mr-1 w-4 h-4" />
          <span className="text-sm font-bold">{totalWarningCount}</span>
        </div>
      </div>

      {/* Warning List */}
      <div className="flex-1 overflow-auto p-1">
        {fileNames.length === 0 ? (
          <p className="text-gray-400 text-sm mt-2 ml-2">No warnings found.</p>
        ) : (
          fileNames.map(fileName => (
            <div key={fileName} className="mb-1">
              <div
                className="flex items-center p-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors duration-150 ease-in-out"
                onClick={() => toggleFile(fileName)}
              >
                <ChevronRight
                  className={`text-gray-500 mr-2 transition-transform duration-200 w-4 h-4 ${
                    openFiles.has(fileName) ? 'transform rotate-90' : ''
                  }`}
                />
                {getFileIcon(fileName)}
                <span className="text-sm">{fileName}</span>
                <div className="ml-auto flex items-center">
                  <AlertTriangle className="text-yellow-500 mr-1 w-4 h-4" />
                  <span className="text-sm">{groupedWarnings[fileName].length}</span>
                </div>
              </div>
              {/* Warning Message List */}
              {openFiles.has(fileName) && (
                <div className="pl-8 text-sm">
                  {groupedWarnings[fileName].map((warning, index) => (
                    <div key={index} className="p-1 flex items-center">
                      <AlertTriangle className="text-yellow-500 mr-2 flex-shrink-0 w-4 h-4" />
                      <span>
                        {warning.message}
                        {warning.line && (
                          <span className="text-gray-500 ml-2">{`[Ln ${warning.line}]`}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WarningPanel;
