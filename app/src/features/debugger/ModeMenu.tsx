import { useEffect } from 'react';
import type { MachineMode } from '@/api/types';
import { useStrings } from '@/i18n';

interface ModeButtonProps {
  mode: MachineMode;
  /** While a program runs, the mode is shown but cannot be changed. */
  disabled: boolean;
  expanded: boolean;
  onClick: () => void;
}

/** The machine button: shows SIC or SIC/XE, and opens the mode menu. */
export function ModeButton({ mode, disabled, expanded, onClick }: ModeButtonProps) {
  const t = useStrings();
  const colors =
    mode === 'SICXE'
      ? 'border-blue-300 bg-blue-50 text-blue-700'
      : 'border-gray-300 bg-gray-50 text-gray-800';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="menu"
      aria-expanded={expanded}
      className={`inline-flex h-7 shrink-0 items-center rounded-md border px-2 text-xs font-semibold transition-colors ${colors} ${
        disabled ? 'cursor-default opacity-60' : 'hover:bg-gray-100'
      }`}
      title={disabled ? t.run.machineLocked : t.run.machineTitle}
    >
      {mode === 'SICXE' ? t.run.sicxe : t.run.sic}
    </button>
  );
}

interface ModeMenuProps {
  mode: MachineMode;
  onChange: (mode: MachineMode) => void;
  onClose: () => void;
}

/** The menu under the machine button. A choice closes it, and so does Escape. */
export function ModeMenu({ mode, onChange, onClose }: ModeMenuProps) {
  const t = useStrings();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const options: { value: MachineMode; label: string }[] = [
    { value: 'SIC', label: t.run.sic },
    { value: 'SICXE', label: t.run.sicxe },
  ];
  return (
    <div
      role="menu"
      className="absolute top-full right-0 z-10 mt-1 flex min-w-28 flex-col rounded-md border border-gray-300 bg-white p-1 shadow-lg"
    >
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          role="menuitemradio"
          aria-checked={mode === value}
          autoFocus={mode === value}
          onClick={() => {
            onChange(value);
            onClose();
          }}
          className={`flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-100 ${
            mode === value ? 'font-semibold text-blue-700' : 'text-gray-800'
          }`}
        >
          <span className="w-3 text-center">{mode === value ? '●' : ''}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
