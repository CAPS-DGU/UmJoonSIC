interface MemoryViewerProps {
  memoryData: Record<string, string[]>;
}

export default function MemoryViewer({ 
  memoryData 
}: MemoryViewerProps) {
  const keys = Object.keys(memoryData);
  const values = Object.values(memoryData);

  return (
    <section className="flex flex-col px-2">
      <h2 className='text-lg font-bold'>메모리 뷰어</h2>
      <div className='w-full mt-2 flex justify-start items-start px-2'>
        <KeyColumn keys={keys} />
        <ValueColumn values={values} />
      </div>
    </section>
  );
}


function ValueColumn({ values }: { values: string[][] }) {
  return (
    <div className="flex flex-col gap-2 pl-4">
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          {v.map((val, index) => (
            <span key={index} className="font-mono">
              {val}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}


function KeyColumn({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-col gap-2 pr-4 border-r border-gray-300">
      {keys.map((key) => (
        <p key={key} className="text-base font-normal">
          {key}
        </p>
      ))}
    </div>
  );
}