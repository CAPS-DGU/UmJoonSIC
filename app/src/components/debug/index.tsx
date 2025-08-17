/** 에디터 우측 디버그창 */

import RunIcon from '@/assets/icons/debug/run.svg';
import ReRunIcon from '@/assets/icons/debug/rerun.svg';
import StopIcon from '@/assets/icons/debug/stop.svg';

import RegisterValue from './RegisterValue';

export default function Debug() {
  return (
    <div className="flex flex-col w-max border border-gray-200">
      <section className='flex w-full items-center justify-between border-b border-gray-200 h-[54px] px-2'>
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
      <RegisterValue registerData={DUMMY_REGISTER_DATA} />
      <pre>Console output will appear here...</pre>
    </div>
  )
};

const DUMMY_REGISTER_DATA = {
  PC: '0x0000',
  SP: '0x0000',
  LR: '0x0000',
  CPSR: '0x0000',
};
