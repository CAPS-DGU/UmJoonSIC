import { useState, useMemo } from 'react';
import { File, FileCode, ChevronRight, Settings, List, CircleX } from 'lucide-react';
import { useErrorStore } from '@/features/panel/errorStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import type { CompileError } from '@/features/panel/errorStore';
import { translateAssemblerMessage } from '@/i18n/assemblerMessages';
import { useStrings } from '@/i18n';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { PANEL_HEADER } from '@/lib/controls';

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
  if (fileName === 'project.sic') return <Settings className="text-gray-600 mr-2 w-4 h-4" />;
  if (fileName.toLowerCase().endsWith('.lst'))
    return <List className="text-gray-600 mr-2 w-4 h-4" />;
  // The same icon as in the file tree, the tabs and the Watch.
  if (fileName.toLowerCase().endsWith('.asm'))
    return <FileCode className="text-green-700 mr-2 w-4 h-4" />;
  return <File className="text-gray-600 mr-2 w-4 h-4" />;
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
  const t = useStrings();
  const language = usePreferencesStore(s => s.language);
  // Files are expanded: the errors are what the panel is for (a click collapses one).
  const [closedFiles, setClosedFiles] = useState<Set<string>>(new Set());
  const isOpen = (fileName: string) => !closedFiles.has(fileName);
  const errors = useErrorStore(state => state.errors);
  const openTab = useEditorTabStore(state => state.openTab);

  const errorsByFile = useMemo(() => groupErrorsByFile(errors), [errors]);
  const fileNames = Object.keys(errorsByFile);
  const totalErrorCount = Object.values(errorsByFile).reduce((sum, list) => sum + list.length, 0);

  const toggleFile = (fileName: string) => {
    setClosedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) newSet.delete(fileName);
      else newSet.add(fileName);
      return newSet;
    });
  };

  /** Open the file at the error's position. */
  const handleErrorClick = (item: ErrorItem) => {
    const cursor = { line: item.line ?? 1, column: item.col ?? 1 };
    openTab({ title: item.file, filePath: item.filePath, cursor });
  };

  return (
    <div className="bg-gray-100 text-gray-900 flex flex-col h-full overflow-hidden">
      {/* The count, when there are errors (with none, the body says so once). */}
      {totalErrorCount > 0 && (
        <div className={PANEL_HEADER}>
          <span className="text-sm font-semibold text-red-700">
            {t.panel.errorCount(totalErrorCount)}
          </span>
        </div>
      )}

      {/* errors, grouped by file */}
      <div className="slim-scroll flex-1 overflow-auto p-2">
        {fileNames.length === 0 ? (
          <p className="text-gray-600 text-sm mt-2 ml-2">{t.panel.noErrors}</p>
        ) : (
          fileNames.map(fileName => {
            const fileErrors = errorsByFile[fileName] ?? [];
            if (fileErrors.length === 0) return null;

            return (
              <div key={fileName} className="mb-1">
                <div
                  className="flex items-center p-2 cursor-pointer hover:bg-gray-200 rounded transition-colors duration-150 ease-in-out"
                  onClick={() => toggleFile(fileName)}
                >
                  <ChevronRight
                    className={`text-gray-500 mr-2 transition-transform duration-200 w-4 h-4 ${
                      isOpen(fileName) ? 'transform rotate-90' : ''
                    }`}
                  />
                  {getFileIcon(fileErrors[0]?.file ?? 'Unknown')}
                  <p className="text-sm">
                    <span className="font-semibold">{fileErrors[0]?.file ?? ''}</span>
                    {/* The folder, only when the file is not at the project's root. */}
                    {fileErrors[0] && fileErrors[0].filePath !== fileErrors[0].file && (
                      <span className="text-gray-600 text-xs ml-1">({fileErrors[0].filePath})</span>
                    )}
                  </p>
                  <div className="ml-auto flex items-center">
                    <CircleX className="text-red-500 mr-1 w-4 h-4" />
                    <span className="text-sm">{fileErrors.length}</span>
                  </div>
                </div>

                {isOpen(fileName) && (
                  <div className="pl-8 text-sm">
                    {fileErrors.map((item, index) => (
                      <div
                        key={index}
                        className="p-1 flex items-center cursor-pointer hover:bg-gray-200 rounded"
                        onClick={() => handleErrorClick(item)}
                      >
                        <CircleX className="text-red-500 mr-2 flex-shrink-0 w-4 h-4" />
                        <span>
                          {translateAssemblerMessage(item.message, language)}
                          {item.line && (
                            <span className="text-gray-600 ml-2">
                              {t.status.lineCol(item.line, item.col ?? 1)}
                            </span>
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
