import type { ReactNode } from 'react';
import { BAR_ICON_BUTTON } from '@/lib/controls';

interface ToolbarButtonProps {
  /** Tooltip; the buttons show only an icon. */
  title: string;
  onClick: () => void;
  children: ReactNode;
}

export function ToolbarButton({ title, onClick, children }: ToolbarButtonProps) {
  return (
    <button onClick={onClick} className={BAR_ICON_BUTTON} title={title}>
      {children}
    </button>
  );
}
