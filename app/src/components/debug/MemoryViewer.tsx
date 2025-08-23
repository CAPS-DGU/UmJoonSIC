import { useMemoryViewStore } from '@/stores/MemoryViewStore';
import type { MemoryNodeData, MemoryNodeStatus, MemoryLabel } from '@/types/debug/memoryData';

export default function MemoryViewer() {
  const memoryRange = { start: 1010, end: 1060 }; // useMemoryViewStore(state => state.memoryRange);
  const memoryValues = MOCK_MEMORY_DATA; // useMemoryViewStore(state => state.memoryValues);
  const labels = MOCK_LABELS; //useMemoryViewStore(state => state.labels);
  const ROW_SIZE = 8;

  // 8바이트 단위로 묶기
  const rows: MemoryNodeData[][] = [];
  for (let i = 0; i < memoryValues.length; i += ROW_SIZE) {
    rows.push(memoryValues.slice(i, i + ROW_SIZE));
  }
  const addresses = Array.from({ length: rows.length }, (_, i) => memoryRange.start + i * ROW_SIZE);

  return (
    <section className="flex flex-col px-2">
      <h2 className="text-lg font-bold">메모리 뷰어</h2>
      <div className="w-full mt-2 flex justify-start items-start px-2">
        <KeyColumn addresses={addresses} />
        <div className="flex flex-col">
          <ValueColumn rows={rows} labels={labels} rowStartAddresses={addresses} />
        </div>
      </div>
    </section>
  );
}

function KeyColumn({ addresses }: { addresses: number[] }) {
  return (
    <div className="flex flex-col gap-2 pr-4 border-r border-gray-300">
      {addresses.map(addr => (
        <p key={addr} className="text-sm font-normal font-mono mb-2">
          {addr.toString(16).toUpperCase().padStart(4, '0')}
        </p>
      ))}
    </div>
  );
}

function ValueColumn({
  rows,
  labels,
  rowStartAddresses,
}: {
  rows: MemoryNodeData[][];
  labels: MemoryLabel[];
  rowStartAddresses: number[];
}) {
  return (
    <div className="flex flex-col gap-2 pl-4 relative">
      {rows.map((row, rowIndex) => {
        const rowStartIndex = rowStartAddresses[rowIndex];
        const rowEndIndex = rowStartIndex + row.length - 1;

        // 이 행에 포함되는 라벨만
        const rowLabels = labels
          .filter(l => l.end >= rowStartIndex && l.start <= rowEndIndex)
          .map(l => ({
            ...l,
            start: Math.max(l.start, rowStartIndex) - rowStartIndex,
            end: Math.min(l.end, rowEndIndex) - rowStartIndex,
          }));

        return (
          <div key={rowIndex} className="flex flex-col space-y-1 relative">
            {/* 값 */}
            <div className="flex relative mb-2">
              {row.map((node, idx) => {
                const label = rowLabels.find(l => idx >= l.start && idx <= l.end);
                return (
                  <MemoryNode
                    key={idx}
                    val={node.value}
                    status={node.status}
                    labelHighlight={!!label}
                  />
                );
              })}

              {/* 라벨 밑줄 & 이름 */}
              {rowLabels.map((label, idx) => {
                const left = label.start * 24; // w-6 + gap
                const width = (label.end - label.start + 1) * 24;
                return (
                  <div
                    key={idx}
                    className="absolute -bottom-4 border-t-2 border-orange-500 text-xs text-orange-500 text-center font-mono"
                    style={{ left, width }}
                  >
                    {label.name}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MemoryNode({
  val,
  status,
  labelHighlight,
}: {
  val: string;
  status?: MemoryNodeStatus;
  labelHighlight?: boolean;
}) {
  const statusClasses = {
    normal: '',
    highlighted: 'bg-yellow-200',
    'red bold': 'text-red-500 font-bold',
  };

  return (
    <span
      className={`font-mono text-sm px-1 w-6 text-center ${
        statusClasses[status || 'normal']
      } ${labelHighlight ? '!text-orange-500 font-semibold' : ''}`}
    >
      {val}
    </span>
  );
}

const MOCK_MEMORY_DATA: MemoryNodeData[] = Array.from({ length: 64 }, (_, i) => ({
  value: (i + 0x20).toString(16).toUpperCase().padStart(2, '0'),
  status: i % 5 === 0 ? 'highlighted' : 'normal',
}));

const MOCK_LABELS: MemoryLabel[] = [
  { start: 1012, end: 1015, name: 'playerHP' }, // 4 bytes
  { start: 1020, end: 1025, name: 'score' }, // 6 bytes
  { start: 1030, end: 1037, name: 'inventory' }, // 8 bytes
  { start: 1048, end: 1052, name: 'position' }, // 5 bytes. 다음 행에 걸쳐 있음
];
