import { useMemoryViewStore } from '@/stores/MemoryViewStore';
import type { MemoryNodeData, MemoryNodeStatus, MemoryLabel } from '@/types/debug/memoryData';

function getAddressRange({ start, end }: { start: number; end: number }, step = 8): number[] {
  const addresses: number[] = [];
  for (let addr = start; addr <= end; addr += step) {
    addresses.push(addr);
  }
  return addresses;
}

export default function MemoryViewer() {
  const memoryRange = useMemoryViewStore(state => state.memoryRange);
  // 여기서는 store 대신 MOCK 데이터 사용 (디버깅용)
  const memoryData = MOCK_MEMORY_DATA;
  const range = { start: 1000, end: 1060 };
  const addresses = getAddressRange(range, 8);

  // 8개씩 묶어서 행(row) 만들기
  const rows: MemoryNodeData[][] = [];
  for (let i = 0; i < memoryData.length; i += 8) {
    rows.push(memoryData.slice(i, i + 8));
  }

  return (
    <section className="flex flex-col px-2">
      <h2 className="text-lg font-bold">메모리 뷰어</h2>
      <div className="w-full mt-2 flex justify-start items-start px-2">
        <KeyColumn addresses={addresses} />
        <ValueColumn rows={rows} />
      </div>
    </section>
  );
}

function KeyColumn({ addresses }: { addresses: number[] }) {
  return (
    <div className="flex flex-col gap-2 pr-4 border-r border-gray-300">
      {addresses.map(addr => (
        <p key={addr} className="text-base font-normal font-mono">
          {addr.toString(16).toUpperCase().padStart(4, '0')}
        </p>
      ))}
    </div>
  );
}

function ValueColumn({ rows }: { rows: MemoryNodeData[][] }) {
  return (
    <div className="flex flex-col gap-2 pl-4">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-2">
          {row.map((nodeData, nodeIndex) => (
            <MemoryNode key={nodeIndex} val={nodeData.value} status={nodeData.status} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MemoryNode({ val, status }: { val: string; status?: MemoryNodeStatus }) {
  const statusClasses = {
    normal: '',
    highlighted: 'bg-yellow-200',
    'red bold': 'text-red-500 font-bold',
  };

  return (
    <span className={`font-mono text-sm px-1 w-6 text-center ${statusClasses[status || 'normal']}`}>
      {val}
    </span>
  );
}

const MOCK_MEMORY_DATA: MemoryNodeData[] = [
  { value: '48', status: 'highlighted' },
  { value: '65', status: 'normal' },
  { value: '6C', status: 'normal' },
  { value: '6C', status: 'normal' },
  { value: '6F', status: 'red bold' },
  { value: '2C', status: 'normal' },
  { value: '20', status: 'normal' },
  { value: '41', status: 'normal' },

  { value: '20', status: 'normal' },
  { value: '4C', status: 'normal' },
  { value: '65', status: 'normal' },
  { value: '74', status: 'normal' },
  { value: '27', status: 'normal' },
  { value: '73', status: 'normal' },
  { value: '20', status: 'normal' },
  { value: '68', status: 'normal' },

  { value: '74', status: 'normal' },
  { value: '68', status: 'normal' },
  { value: '69', status: 'normal' },
  { value: '73', status: 'normal' },
  { value: '2E', status: 'normal' },
  { value: '00', status: 'normal' },
  { value: '36', status: 'normal' },
  { value: '5F', status: 'normal' },

  { value: '48', status: 'normal' },
  { value: '65', status: 'normal' },
  { value: '6C', status: 'normal' },
  { value: '6C', status: 'normal' },
  { value: '6F', status: 'highlighted' },
  { value: '2C', status: 'highlighted' },
  { value: '20', status: 'highlighted' },
  { value: '41', status: 'highlighted' },

  { value: '20', status: 'normal' },
  { value: '4C', status: 'normal' },
  { value: '65', status: 'normal' },
  { value: '74', status: 'normal' },
  { value: '27', status: 'normal' },
  { value: '73', status: 'normal' },
  { value: '20', status: 'normal' },
  { value: '68', status: 'normal' },

  { value: '74', status: 'red bold' },
  { value: '68', status: 'red bold' },
  { value: '69', status: 'red bold' },
  { value: '73', status: 'normal' },
  { value: '2E', status: 'normal' },
  { value: '00', status: 'normal' },
  { value: '36', status: 'normal' },
  { value: '5F', status: 'normal' },

  { value: '48', status: 'normal' },
  { value: '65', status: 'normal' },
  { value: '6C', status: 'normal' },
  { value: '6C', status: 'normal' },
  { value: '6F', status: 'normal' },
  { value: '2C', status: 'normal' },
  { value: '20', status: 'normal' },
  { value: '41', status: 'normal' },

  { value: '20', status: 'normal' },
  { value: '4C', status: 'normal' },
  { value: '65', status: 'normal' },
  { value: '74', status: 'normal' },
  { value: '27', status: 'normal' },
  { value: '73', status: 'normal' },
  { value: '20', status: 'normal' },
  { value: '68', status: 'normal' },

  { value: '74', status: 'normal' },
  { value: '68', status: 'normal' },
  { value: '69', status: 'normal' },
  { value: '73', status: 'normal' },
  { value: '2E', status: 'normal' },
  { value: '00', status: 'normal' },
  { value: '36', status: 'normal' },
  { value: '5F', status: 'normal' },
];
