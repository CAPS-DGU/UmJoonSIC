import { useState, useCallback } from 'react';
import { useErrorStore } from '@/stores/pannel/ErrorStore';
import type { AssemblerError, SyntaxCheckResult } from '@/types/DTO';

// ----- 커스텀 훅 -----
export function useSyntaxCheck() {
  const [result, setResult] = useState<SyntaxCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async (texts: string[], fileNames: string[]) => {
    if (!texts?.length || !fileNames?.length || texts.length !== fileNames.length) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('http://localhost:9090/syntax-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, fileNames }),
      });

      if (!res.ok) throw new Error('서버 요청 실패');

      const data: SyntaxCheckResult = await res.json();
      setResult(data);
      console.log(data);

      // ----- Zustand 에러 스토어 갱신 -----
      fileNames.forEach((fileName, idx) => {
        const newErrors: (AssemblerError & { type: 'syntax' })[] =
          data.files[idx]?.assemblerErrors?.map(err => ({
            ...err,
            type: 'syntax',
          })) ?? [];

        useErrorStore.getState().addErrors(fileName, newErrors);
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류 발생');
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, runCheck };
}
