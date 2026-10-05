import { useEffect, useState } from 'react';

/** The size of an element, kept current as it changes (0 × 0 until it is mounted). */
export function useElementSize(element: HTMLElement | null) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return size;
}
