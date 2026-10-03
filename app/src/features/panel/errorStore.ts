import { create } from 'zustand';
import { useProjectStore } from '@/features/project/projectStore';
import { toProjectRelativePath } from '@/lib/projectPath';

export type CompileErrorType = 'syntax' | 'load';

export interface CompileError {
  row: number;
  col: number;
  length?: number;
  message: string;
  type: CompileErrorType;
}

interface ErrorStore {
  errors: { [fileName: string]: CompileError[] };
  addErrors: (fileName: string, errors: CompileError[]) => void;
  /** Clear the errors of one file, or of every file; only those of `type` if given. */
  clearErrors: (fileName?: string, type?: CompileErrorType) => void;
}

export const useErrorStore = create<ErrorStore>(set => ({
  errors: {},
  addErrors: (fileName, errors) => {
    const projectPath = useProjectStore.getState().projectPath;
    const relativeFileName = toProjectRelativePath(projectPath, fileName);
    fileName = relativeFileName; // 프로젝트 루트 기준 상대경로로 저장
    // The file's errors are replaced; a file without errors has no entry.
    set(state => {
      const next = { ...state.errors, [fileName]: errors };
      if (errors.length === 0) delete next[fileName];
      return { errors: next };
    });
  },
  clearErrors: (fileName, type) =>
    set(state => {
      const files = fileName ? [fileName] : Object.keys(state.errors);
      const errors = { ...state.errors };
      for (const file of files) {
        if (!errors[file]) continue;
        const remaining = type ? errors[file].filter(err => err.type !== type) : [];
        if (remaining.length > 0) {
          errors[file] = remaining;
        } else {
          delete errors[file];
        }
      }
      return { errors };
    }),
}));
