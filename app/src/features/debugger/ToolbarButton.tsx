import type { ReactNode } from 'react';

interface ToolbarButtonProps {
  /** Tooltip; the buttons show only an icon. */
  title: string;
  onClick: () => void;
  children: ReactNode;
}

export function ToolbarButton({ title, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className="hover:bg-gray-100 p-2 rounded-md transition-colors"
      title={title}
    >
      {children}
    </button>
  );
}
