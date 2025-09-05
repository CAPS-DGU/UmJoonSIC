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
  addErrors: (fileName, newErrors) =>
    set(state => {
      const existing = state.errors[fileName] ?? [];

      // 기존 에러와 비교 후 merge
      const merged = [...existing];

      newErrors.forEach(ne => {
        const idx = merged.findIndex(
          ee =>
            ee.row === ne.row &&
            ee.col === ne.col &&
            ee.length === ne.length &&
            ee.message === ne.message,
        );

        if (idx >= 0) {
          // 이미 같은 에러가 있는데, 새 타입이 load면 교체
          if (ne.type === 'load' && merged[idx].type === 'syntax') {
            merged[idx] = { ...merged[idx], type: 'load' };
          }
          // 그 외에는 무시 (중복 방지)
        } else {
          merged.push(ne);
        }
      });

      return {
        errors: { ...state.errors, [fileName]: merged },
      };
    }),
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
