import React, { useEffect, useState } from 'react';

interface ResizerProps {
  onResize: (newHeight: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  statusBarHeight: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const Resizer: React.FC<ResizerProps> = ({
  onResize,
  containerRef,
  statusBarHeight,
  onDragStart,
  onDragEnd,
}) => {
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
};

export default Resizer;
