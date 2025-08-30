import { useState, useEffect } from 'react';

// ----- 타입 정의 -----
export interface CompileError {
  row: number;
  col: number;
  message: string;
  nonbreaking: boolean;
}

export interface SyntaxCheckFileResult {
  fileName: string;
  ok: boolean;
  compileErrors?: CompileError[] | null;
}

export interface SyntaxCheckResult {
  ok: boolean;
  message: string;
  files: SyntaxCheckFileResult[];
}

// ----- 커스텀 훅 -----
export function useSyntaxCheck(texts: string[], fileNames: string[]) {
  const [result, setResult] = useState<SyntaxCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // texts/fileNames 둘 다 유효해야 호출
    if (!texts?.length || !fileNames?.length || texts.length !== fileNames.length) return;

    const fetchData = async () => {
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
        console.log('Syntax check result:', data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('알 수 없는 오류 발생');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [texts, fileNames]);

  return { result, loading, error };
}
