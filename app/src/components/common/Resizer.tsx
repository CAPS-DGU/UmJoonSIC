import React from 'react';

interface ResizerProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

const Resizer = ({ onMouseDown }: ResizerProps) => {
  return (
    <div
      className="w-full h-1 cursor-ns-resize bg-gray-600 hover:bg-gray-400 transition-colors duration-200 ease-in-out"
      onMouseDown={onMouseDown}
    />
  );
};

export default Resizer;
