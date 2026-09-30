import { useState, useMemo } from 'react';
import { File, ChevronRight, Settings, List, CircleX } from 'lucide-react';
import { useErrorStore } from '@/features/panel/errorStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import type { CompileError } from '@/features/panel/errorStore';

/** One error as a row of the panel. */
interface ErrorItem {
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

/** Panel rows per file, keyed by the file's project-relative path. */
const groupErrorsByFile = (errors: { [fileName: string]: CompileError[] }) => {
  const grouped: Record<string, ErrorItem[]> = {};
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

export default function ErrorPanel() {
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());
  const errors = useErrorStore(state => state.errors);
  const { tabs, openTab, setActiveTab, setCursor } = useEditorTabStore();

  const errorsByFile = useMemo(() => groupErrorsByFile(errors), [errors]);
  const fileNames = Object.keys(errorsByFile);
  const totalErrorCount = Object.values(errorsByFile).reduce((sum, list) => sum + list.length, 0);

  const toggleFile = (fileName: string) => {
    setOpenFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) newSet.delete(fileName);
      else newSet.add(fileName);
      return newSet;
    });
  };

  /** Open the file at the error's position. */
  const handleErrorClick = (item: ErrorItem) => {
    const cursor = { line: item.line ?? 1, column: item.col ?? 1 };
    const tabIdx = tabs.findIndex(t => t.filePath === item.filePath);
    if (tabIdx === -1) {
      openTab({ title: item.file, filePath: item.filePath, cursor });
      return;
    }
    setActiveTab(tabIdx);
    // Move the cursor after the tab has been activated.
    setTimeout(() => setCursor(tabIdx, cursor), 0);
  };

  return (
    <div className="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center p-2 border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-center">
          <CircleX className="text-red-500 mr-1 w-4 h-4" />
          <span className="font-semibold text-sm">Errors</span>
        </div>
        <div className="ml-auto flex items-center">
          <CircleX className="text-red-500 mr-1 w-4 h-4" />
          <span className="text-sm font-bold">{totalErrorCount}</span>
        </div>
      </div>

      {/* errors, grouped by file */}
      <div className="flex-1 overflow-auto p-1">
        {fileNames.length === 0 ? (
          <p className="text-gray-400 text-sm mt-2 ml-2">No Error found.</p>
        ) : (
          fileNames.map(fileName => {
            const fileErrors = errorsByFile[fileName] ?? [];
            if (fileErrors.length === 0) return null;

            return (
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
                  {getFileIcon(fileErrors[0]?.file ?? 'Unknown')}
                  <p className="text-sm">
                    <span className="font-semibold">{fileErrors[0]?.file ?? 'Unknown'}</span>
                    <span className="text-gray-400 text-xs ml-1 italic">
                      ({fileErrors[0]?.filePath ?? 'Unknown'})
                    </span>
                  </p>
                  <div className="ml-auto flex items-center">
                    <CircleX className="text-red-500 mr-1 w-4 h-4" />
                    <span className="text-sm">{fileErrors.length}</span>
                  </div>
                </div>

                {openFiles.has(fileName) && (
                  <div className="pl-8 text-sm">
                    {fileErrors.map((item, index) => (
                      <div
                        key={index}
                        className="p-1 flex items-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        onClick={() => handleErrorClick(item)}
                      >
                        <CircleX className="text-red-500 mr-2 flex-shrink-0 w-4 h-4" />
                        <span>
                          {item.message}
                          {item.line && (
                            <span className="text-gray-500 ml-2">{`[Ln ${item.line}] [Col ${item.col}]`}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
