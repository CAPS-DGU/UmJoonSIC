import { useState, useMemo } from 'react';
import { File, ChevronRight, AlertTriangle, Settings, List } from 'lucide-react';
import { useErrorStore } from '@/stores/pannel/ErrorStore';
import type { CompileError } from '@/stores/pannel/ErrorStore';

// 경고 메시지 타입 정의
interface WarningMessage {
  file: string;
  filePath: string;
  message: string;
  line?: number;
  col?: number;
}

const getFileName = (filePath: string) => {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1];
};

const getFileIcon = (fileName: string) => {
  if (fileName === 'project.sic') return <Settings className="text-gray-500 mr-2 w-4 h-4" />;
  if (fileName.toLowerCase().endsWith('.lst'))
    return <List className="text-gray-500 mr-2 w-4 h-4" />;
  return <File className="text-gray-500 mr-2 w-4 h-4" />;
};

// 파일별 경고 그룹화
const groupWarningsByFile = (errors: { [fileName: string]: CompileError[] }) => {
  const grouped: Record<string, WarningMessage[]> = {};
  Object.entries(errors).forEach(([file, errs]) => {
    grouped[file] = errs.map(err => ({
      file: getFileName(file),
      filePath: file,
      message: err.message,
      line: err.row,
      col: err.col,
    }));
  });
  return grouped;
};

export default function WarningPanel() {
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());
  const errors = useErrorStore(state => state.errors);

  // useMemo로 계산 최적화
  const groupedWarnings = useMemo(() => groupWarningsByFile(errors), [errors]);
  const fileNames = Object.keys(groupedWarnings);
  const totalWarningCount = Object.values(groupedWarnings).reduce(
    (sum, list) => sum + list.length,
    0,
  );

  const toggleFile = (fileName: string) => {
    setOpenFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) newSet.delete(fileName);
      else newSet.add(fileName);
      return newSet;
    });
  };

  return (
    <div className="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
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
                <p className="text-sm">
                  <span className="font-semibold">{groupedWarnings[fileName][0].file}</span>
                  <span className="text-gray-400 text-xs ml-1 italic">
                    ({groupedWarnings[fileName][0].filePath})
                  </span>
                </p>
                <div className="ml-auto flex items-center">
                  <AlertTriangle className="text-yellow-500 mr-1 w-4 h-4" />
                  <span className="text-sm">{groupedWarnings[fileName].length}</span>
                </div>
              </div>

              {openFiles.has(fileName) && (
                <div className="pl-8 text-sm">
                  {groupedWarnings[fileName].map((warning, index) => (
                    <div key={index} className="p-1 flex items-center">
                      <AlertTriangle className="text-yellow-500 mr-2 flex-shrink-0 w-4 h-4" />
                      <span>
                        {warning.message}
                        {warning.line && (
                          <span className="text-gray-500 ml-2">{`[Ln ${warning.line}] [Col ${warning.col}]`}</span>
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
}
