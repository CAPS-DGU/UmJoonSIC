/** 에디터 우측 디버그창 */

import RunIcon from '@/assets/icons/debug/run.svg';
import ReRunIcon from '@/assets/icons/debug/rerun.svg';
import StopIcon from '@/assets/icons/debug/stop.svg';

import RegisterValue from './RegisterValue';
import MemoryViewer from './MemoryViewer';

export default function Debug() {
  return (
    <div className="flex flex-col w-max border border-gray-200">
      <section className='flex w-full items-center justify-between border-b border-gray-200 py-3 h-[54px] px-2'>
        <h2 className='text-lg font-bold'>실행 및 디버그</h2>
        <div className='flex space-x-2'>
          <button className='hover:bg-gray-100 p-2 rounded-md transition-colors'>
            <img src={RunIcon} alt="Run" className='w-4 h-4' />
          </button>
          <button className='hover:bg-gray-100 p-2 rounded-md transition-colors'>
            <img src={ReRunIcon} alt="ReRun" className='w-4 h-4' />
          </button>
          <button className='hover:bg-gray-100 p-2 rounded-md transition-colors'>
            <img src={StopIcon} alt="Stop" className='w-4 h-4' />
          </button>
        </div>
      </section>
      <section className='border-b border-gray-200 py-3'>
        <RegisterValue registerData={DUMMY_REGISTER_DATA} />
      </section>
      <section className='border-b border-gray-200 py-3'>
        <MemoryViewer memoryData={DUMMY_MEMORY_DATA} />
      </section>
    </div>
  )
};

const DUMMY_REGISTER_DATA = {
  PC: '0x0000',
  SP: '0x0000',
  LR: '0x0000',
  CPSR: '0x0000',
};

const DUMMY_MEMORY_DATA = {
  1000: ['48', '65', '6C', '6C', '6F', '2C', '20', '41'],
  1010: ['20', '4C', '65', '74', '27', '73', '20', '68'],
  1020: ['74', '68', '69', '73', '2E', '00', '36', '5F'],
  1030: ['48', '65', '6C', '6C', '6F', '2C', '20', '41'],
  1040: ['20', '4C', '65', '74', '27', '73', '20', '68'],
  1050: ['74', '68', '69', '73', '2E', '00', '36', '5F'],
  1060: ['48', '65', '6C', '6C', '6F', '2C', '20', '41'],
  1070: ['20', '4C', '65', '74', '27', '73', '20', '68'],
  1080: ['74', '68', '69', '73', '2E', '00', '36', '5F'],
};
