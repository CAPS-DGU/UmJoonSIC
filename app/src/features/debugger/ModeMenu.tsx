import type { MachineMode } from '@/api/types';

const MODES: { value: MachineMode; label: string }[] = [
  { value: 'SIC', label: 'SIC 모드' },
  { value: 'SICXE', label: 'SIC/XE 모드' },
];

const MODE_NAME: Record<MachineMode, string> = { SIC: 'SIC', SICXE: 'SIC/XE' };

interface ModeButtonProps {
  mode: MachineMode;
  /** While a program runs, the mode is shown but cannot be changed. */
  disabled: boolean;
  onClick: () => void;
}

/** The architecture button: shows the machine mode, and opens the mode menu. */
export function ModeButton({ mode, disabled, onClick }: ModeButtonProps) {
  const colors =
    mode === 'SICXE'
      ? 'border-blue-300 bg-blue-50 text-blue-700'
      : 'border-gray-300 bg-gray-50 text-gray-700';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded-md border text-sm font-semibold transition-colors ${colors} ${
        disabled ? 'opacity-60 cursor-default' : 'hover:bg-gray-100'
      }`}
      title={disabled ? '실행 중에는 아키텍처를 바꿀 수 없습니다' : '아키텍처 설정'}
    >
      {MODE_NAME[mode]}
    </button>
  );
}

interface ModeMenuProps {
  mode: MachineMode;
  onChange: (mode: MachineMode) => void;
}

/** Drop-down under the architecture button: choose between SIC and SIC/XE. */
export function ModeMenu({ mode, onChange }: ModeMenuProps) {
  return (
    <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg p-2 z-10">
      <div className="flex flex-col space-y-1">
        {MODES.map(({ value, label }) => (
          <label key={value} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="machineMode"
              value={value}
              checked={mode === value}
              onChange={() => onChange(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
