import { useMemo } from 'react';
import { debounce } from 'es-toolkit/function';

export function useDebounceFn<T extends (...args: string[][]) => unknown>(fn: T, delay: number) {
  const debounced = useMemo(() => debounce(fn, delay), [fn, delay]);
  return debounced;
}
