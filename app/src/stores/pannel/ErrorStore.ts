import { create } from 'zustand';

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
  clearErrors: (fileName?: string, type?: CompileErrorType) => void;
}

export const useErrorStore = create<ErrorStore>(set => ({
  errors: {},
  addErrors: (fileName, errors) =>
    set(state => ({ errors: { ...state.errors, [fileName]: errors } })),
  clearErrors: (fileName, type) =>
    set(state => {
      const newErrors = { ...state.errors };
      if (!fileName) return { errors: {} };
      if (!newErrors[fileName]) return { errors: newErrors };
      if (!type) {
        delete newErrors[fileName];
      } else {
        newErrors[fileName] = newErrors[fileName].filter(err => err.type !== type);
      }
      return { errors: newErrors };
    }),
}));
