import type { MemoryNodeData, MemoryNodeStatus } from '@/types/debug/memoryData';

interface MemoryViewerProps {
  memoryData: Record<string, MemoryNodeData[]>;
}

export default function MemoryViewer({ memoryData }: MemoryViewerProps) {
  const keys = Object.keys(memoryData);
  const values = Object.values(memoryData);

  return (
    <section className="flex flex-col px-2">
      <h2 className="text-lg font-bold">메모리 뷰어</h2>
      <div className="w-full mt-2 flex justify-start items-start px-2">
        <KeyColumn keys={keys} />
        <ValueColumn values={values} />
      </div>
    </section>
  );
}

function ValueColumn({ values }: { values: MemoryNodeData[][] }) {
  return (
    <div className="flex flex-col gap-2 pl-4">
      {values.map((row, rowIndex) => (
        <div key={rowIndex} className="flex">
          {row.map((nodeData, nodeIndex) => (
            <MemoryNode key={nodeIndex} val={nodeData.value} status={nodeData.status} />
          ))}
        </div>
      ))}
    </div>
  );
}

function KeyColumn({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-col gap-2 pr-4 border-r border-gray-300">
      {keys.map(key => (
        <p key={key} className="text-base font-normal">
          {key}
        </p>
      ))}
    </div>
  );
}

function MemoryNode({ val, status }: { val: string; status?: MemoryNodeStatus }) {
  const statusClasses = {
    normal: '',
    highlighted: 'bg-yellow-200',
    underlined: 'underline text-orange-500',
    'red bold': 'text-red-500 font-bold',
  };

  return <span className={`font-mono px-1 ${statusClasses[status || 'normal']}`}>{val}</span>;
}
