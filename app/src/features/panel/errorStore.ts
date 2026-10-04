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
  /** Errors by project-relative file path; a file without errors has no entry. */
  errors: { [fileName: string]: CompileError[] };
  /**
   * Replace a file's errors with the result of its latest check (a syntax check, or a load
   * of the program); `type` says which. `fileName` may be absolute; it is stored relative
   * to the project.
   */
  setErrors: (
    fileName: string,
    type: CompileErrorType,
    errors: Omit<CompileError, 'type'>[],
  ) => void;
  /** Clear the errors of one file, or of every file; only those of `type` if given. */
  clearErrors: (fileName?: string, type?: CompileErrorType) => void;
}

export const useErrorStore = create<ErrorStore>(set => ({
  errors: {},

  setErrors: (fileName, type, errors) => {
    const file = toProjectRelativePath(useProjectStore.getState().projectPath, fileName);
    set(state => {
      const next = { ...state.errors, [file]: errors.map(err => ({ ...err, type })) };
      if (errors.length === 0) delete next[file];
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
