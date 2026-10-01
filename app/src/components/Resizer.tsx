import { useEffect, useState, type RefObject } from 'react';

interface ResizerProps {
  /** Called with the new height of the area below the bar while dragging. */
  onResize: (newHeight: number) => void;
  /** Element whose bottom edge the height is measured from. */
  containerRef: RefObject<HTMLDivElement | null>;
  statusBarHeight: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/** Horizontal bar that is dragged up and down to change the height of the panel below it. */
export default function Resizer({
  onResize,
  containerRef,
  statusBarHeight,
  onDragStart,
  onDragEnd,
}: ResizerProps) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return;
      const appRect = containerRef.current.getBoundingClientRect();
      const newPanelHeight = appRect.bottom - statusBarHeight - e.clientY;
      onResize(Math.max(0, newPanelHeight));
    };

    const handleMouseUp = () => {
      setDragging(false);
      onDragEnd?.();
    };

    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, containerRef, statusBarHeight, onResize, onDragEnd]);

  return (
    <div
      className="w-full h-1 cursor-ns-resize select-none hover:bg-gray-400 bg-gray-600"
      onMouseDown={e => {
        e.preventDefault();
        onDragStart?.();
        setDragging(true);
      }}
    />
  );
}
