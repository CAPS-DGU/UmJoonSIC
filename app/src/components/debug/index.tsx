/** 에디터 우측 디버그창 */

import RunIcon from '@/assets/icons/debug/run.svg';
import ReRunIcon from '@/assets/icons/debug/rerun.svg';
import StopIcon from '@/assets/icons/debug/stop.svg';

import RegisterValue from './RegisterValue';
import MemoryViewer from './MemoryViewer';

import type { MemoryNodeData } from '@/types/debug/memoryData';

export default function Debug() {
  return (
    <div className="flex flex-col w-max border border-gray-200">
      <section className="flex w-full items-center justify-between border-b border-gray-200 py-3 h-[54px] px-2">
        <h2 className="text-lg font-bold">실행 및 디버그</h2>
        <div className="flex space-x-2">
          <button className="hover:bg-gray-100 p-2 rounded-md transition-colors">
            <img src={RunIcon} alt="Run" className="w-4 h-4" />
          </button>
          <button className="hover:bg-gray-100 p-2 rounded-md transition-colors">
            <img src={ReRunIcon} alt="ReRun" className="w-4 h-4" />
          </button>
          <button className="hover:bg-gray-100 p-2 rounded-md transition-colors">
            <img src={StopIcon} alt="Stop" className="w-4 h-4" />
          </button>
        </div>
      </section>
      <section className="border-b border-gray-200 py-3">
        <RegisterValue registerData={MOCK_REGISTER_DATA} />
      </section>
      <section className="border-b border-gray-200 py-3">
        <MemoryViewer memoryData={MOCK_MEMORY_DATA} />
      </section>
    </div>
  );
}

const MOCK_REGISTER_DATA = {
  A: '0x0000',
  X: '0x0000',
  L: '0x0000',
  S: '0x0000',
  T: '0x0000',
  B: '0x0000',
  SW: '0x0000',
  F: '0x0000',
  'F(double)': '0.0',
  PC: '00A000',
};

const MOCK_MEMORY_DATA: Record<string, MemoryNodeData[]> = {
  1000: [
    { value: '48', status: 'highlighted' },
    { value: '65', status: 'normal' },
    { value: '6C', status: 'normal' },
    { value: '6C', status: 'normal' },
    { value: '6F', status: 'red bold' },
    { value: '2C', status: 'normal' },
    { value: '20', status: 'normal' },
    { value: '41', status: 'underlined' },
  ],
  1010: [
    { value: '20', status: 'normal' },
    { value: '4C', status: 'underlined' },
    { value: '65', status: 'underlined' },
    { value: '74', status: 'underlined' },
    { value: '27', status: 'normal' },
    { value: '73', status: 'normal' },
    { value: '20', status: 'normal' },
    { value: '68', status: 'normal' },
  ],
  1020: [
    { value: '74', status: 'normal' },
    { value: '68', status: 'normal' },
    { value: '69', status: 'normal' },
    { value: '73', status: 'normal' },
    { value: '2E', status: 'normal' },
    { value: '00', status: 'normal' },
    { value: '36', status: 'normal' },
    { value: '5F', status: 'normal' },
  ],
  1030: [
    { value: '48', status: 'normal' },
    { value: '65', status: 'normal' },
    { value: '6C', status: 'normal' },
    { value: '6C', status: 'normal' },
    { value: '6F', status: 'highlighted' },
    { value: '2C', status: 'highlighted' },
    { value: '20', status: 'highlighted' },
    { value: '41', status: 'highlighted' },
  ],
  1040: [
    { value: '20', status: 'normal' },
    { value: '4C', status: 'normal' },
    { value: '65', status: 'normal' },
    { value: '74', status: 'normal' },
    { value: '27', status: 'normal' },
    { value: '73', status: 'normal' },
    { value: '20', status: 'normal' },
    { value: '68', status: 'normal' },
  ],
  1050: [
    { value: '74', status: 'red bold' },
    { value: '68', status: 'red bold' },
    { value: '69', status: 'red bold' },
    { value: '73', status: 'normal' },
    { value: '2E', status: 'normal' },
    { value: '00', status: 'normal' },
    { value: '36', status: 'normal' },
    { value: '5F', status: 'normal' },
  ],
  1060: [
    { value: '48', status: 'normal' },
    { value: '65', status: 'normal' },
    { value: '6C', status: 'normal' },
    { value: '6C', status: 'normal' },
    { value: '6F', status: 'normal' },
    { value: '2C', status: 'normal' },
    { value: '20', status: 'normal' },
    { value: '41', status: 'normal' },
  ],
  1070: [
    { value: '20', status: 'normal' },
    { value: '4C', status: 'normal' },
    { value: '65', status: 'normal' },
    { value: '74', status: 'normal' },
    { value: '27', status: 'normal' },
    { value: '73', status: 'normal' },
    { value: '20', status: 'normal' },
    { value: '68', status: 'normal' },
  ],
  1080: [
    { value: '74', status: 'normal' },
    { value: '68', status: 'normal' },
    { value: '69', status: 'normal' },
    { value: '73', status: 'normal' },
    { value: '2E', status: 'normal' },
    { value: '00', status: 'normal' },
    { value: '36', status: 'normal' },
    { value: '5F', status: 'normal' },
  ],
};
