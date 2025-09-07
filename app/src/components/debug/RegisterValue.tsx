/** 레지스터 값 창 */
import { useState, useEffect } from 'react';
import { useRegisterStore } from '@/stores/RegisterStore';

export default function RegisterValue() {
  const [isOn, setIsOn] = useState(true);
  const { 
    A, X, L, S, T, B, SW, PC, F, 
    changedRegisters, 
    clearChangedRegisters 
  } = useRegisterStore(state => state);
  const getFHex = useRegisterStore(state => state.getFHex);
  const registerData = { A, X, L, S, T, B, SW, PC, F };

  // 애니메이션 완료 후 변경된 레지스터 목록 초기화
  useEffect(() => {
    if (changedRegisters.size > 0) {
      const timer = setTimeout(() => {
        clearChangedRegisters();
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [changedRegisters, clearChangedRegisters]);

  const toggle = () => {
    setIsOn(!isOn);
  };

  return (
    <div className="flex flex-col px-2 gap-2">
      <section className="flex w-full items-center justify-between">
        <h2 className="text-lg font-bold">레지스터 값</h2>
        <div className="flex items-center gap-1">
          <p>HEX MODE</p>
          <button
            onClick={toggle}
            // ARIA 속성을 추가하여 접근성을 높여줍니다.
            role="switch"
            aria-checked={isOn}
            className={`
        relative inline-flex h-7 w-12 items-center rounded-full transition-colors
        ${isOn ? 'bg-blue-500' : 'bg-gray-300'}
      `}
          >
            <span
              className={`
          inline-block h-5 w-5 transform rounded-full bg-white transition-transform
          ${isOn ? 'translate-x-6' : 'translate-x-1'}
        `}
            />
          </button>
        </div>
      </section>
      <div className="w-full mt-2 grid grid-cols-2 gap-2">
        {Object.entries(registerData).map(([key, value]) => {
          const isChanged = changedRegisters.has(key);
          return (
            <div key={key} className={`w-full flex justify-between items-center gap-4 ${key === 'F' ? 'col-span-2' : ''}`}>
              <p className="text-base font-normal">{key}:</p>
              <div className={`w-full h-8 rounded-xl bg-[#CB601529] flex items-center justify-end px-2 transition-all duration-300 overflow-x-auto ${
                isChanged ? 'register-flash' : ''
              }`}>
                {key !== 'F' && (
                  <p className="font-mono text-sm whitespace-nowrap">
                    {isOn ? '0x' + value.toString(16).toUpperCase().padStart(6, '0') : value}
                  </p>
                )}
                {key === 'F' && (
                  <p className="font-mono text-sm whitespace-nowrap">
                    {isOn ? getFHex() : value}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
