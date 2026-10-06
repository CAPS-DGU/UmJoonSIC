import { useEffect, useState } from 'react';
import { toSicFloatHex } from '@/features/debugger/lib/sicFloat';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useStrings } from '@/i18n';

/** How long a changed register stays highlighted; matches the CSS animation. */
const FLASH_MS = 600;

const toHexWord = (value: number) => '0x' + value.toString(16).toUpperCase().padStart(6, '0');

/** Register values, in hex or decimal. */
export default function RegisterPanel() {
  const t = useStrings();
  const [isHex, setIsHex] = useState(true);
  const { A, X, L, S, T, B, SW, PC, F, changedRegisters, clearChangedRegisters } = useRegisterStore(
    state => state,
  );
  const registers = { A, X, L, S, T, B, SW, PC, F };

  // Drop the highlight once the flash animation has played.
  useEffect(() => {
    if (changedRegisters.size > 0) {
      const timer = setTimeout(() => {
        clearChangedRegisters();
      }, FLASH_MS);

      return () => clearTimeout(timer);
    }
  }, [changedRegisters, clearChangedRegisters]);

  return (
    <div className="flex flex-col px-2 gap-2">
      <section className="flex w-full items-center justify-between">
        <h2 className="text-sm font-semibold">{t.registers.title}</h2>
        <label className="flex items-center gap-2" title={t.registers.hexTitle}>
          <span className="text-sm">{t.registers.hex}</span>
          <button
            onClick={() => setIsHex(!isHex)}
            role="switch"
            aria-checked={isHex}
            aria-label={t.registers.hexTitle}
            className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
              isHex ? 'bg-blue-600' : 'bg-gray-400'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                isHex ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </section>
      <div className="w-full mt-2 grid grid-cols-2 gap-2">
        {Object.entries(registers).map(([name, value]) => {
          const isChanged = changedRegisters.has(name);
          // F is a 48-bit float and gets the full width; the others are 24-bit words.
          const isFloat = name === 'F';
          // Hex text is computed only in hex mode; decimal mode shows the raw value.
          const shown = isHex ? (isFloat ? toSicFloatHex(F) : toHexWord(value as number)) : value;
          return (
            <div
              key={name}
              className={`w-full flex justify-between items-center gap-4 ${isFloat ? 'col-span-2' : ''}`}
              data-register={name}
            >
              <p
                className="w-6 shrink-0 cursor-help text-sm font-semibold"
                title={t.registers.names[name]}
              >
                {name}
              </p>
              <div
                className={`w-full h-8 rounded-md border border-gray-300 bg-white flex items-center justify-end px-2 transition-all duration-300 overflow-x-auto ${
                  isChanged ? 'register-flash' : ''
                }`}
              >
                <p className="font-mono text-sm whitespace-nowrap text-gray-900">{shown}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
