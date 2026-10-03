import type { MachineMode } from '@/api/types';

const MODES: { value: MachineMode; label: string }[] = [
  { value: 'SIC', label: 'SIC 모드' },
  { value: 'SICXE', label: 'SIC/XE 모드' },
];

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
