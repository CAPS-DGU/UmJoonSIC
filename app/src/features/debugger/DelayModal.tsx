import { useState } from 'react';

interface DelayModalProps {
  /** Current delay in ms, shown as the initial value. */
  delayTime: number;
  onCancel: () => void;
  onSave: (delayTime: number) => void;
  onSaveAndRun: (delayTime: number) => void;
}

/** Dialog for the delay between instructions of the "run with delay" button. */
export function DelayModal({ delayTime, onCancel, onSave, onSaveAndRun }: DelayModalProps) {
  const [input, setInput] = useState(String(delayTime));

  /** Call `action` with the entered delay, unless it is not a non-negative number. */
  const submit = (action: (delayTime: number) => void) => {
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    action(parsed);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-4 w-80">
        <h3 className="text-base font-semibold mb-2">지연 시간(ms)을 입력하세요</h3>
        <input
          type="number"
          min={0}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit(onSave);
          }}
          className="w-full border border-gray-300 rounded-md px-2 py-1 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300" onClick={onCancel}>
            취소
          </button>
          <button
            className="px-3 py-1 rounded-md bg-blue-500 text-white hover:bg-blue-600"
            onClick={() => submit(onSave)}
          >
            저장
          </button>
          <button
            className="px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700"
            onClick={() => submit(onSaveAndRun)}
          >
            저장 후 실행
          </button>
        </div>
      </div>
    </div>
  );
}
