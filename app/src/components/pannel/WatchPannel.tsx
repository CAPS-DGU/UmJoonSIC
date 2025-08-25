import { useEffect } from 'react';
import { useWatchStore } from '@/stores/pannel/WatchStore';
import type { WatchRow } from '@/stores/pannel/WatchStore';

const toHex = (value: number) => {
  if (typeof value !== 'number' || !Number.isInteger(value)) return '';
  return value.toString(16).toUpperCase().padStart(2, '0');
};

const toChar = (value: number) => {
  if (typeof value !== 'number' || value < 32 || value > 126) {
    return '.';
  }
  return String.fromCharCode(value);
};

export default function WatchPannel() {
  const watch = useWatchStore(s => s.watch);

  // // Populate the store with mock data when the component mounts.
  // useEffect(() => {
  //   const mockData: WatchRow[] = [
  //     { name: 'myVariable', address: 0x100a, dataType: 'int', elementSize: 4, elementCount: 1 },
  //     { name: 'charArray', address: 0x20b4, dataType: 'char', elementSize: 1, elementCount: 16 },
  //     { name: 'someFloat', address: 0x30c8, dataType: 'float', elementSize: 4, elementCount: 1 },
  //     { name: 'shortArray', address: 0x40a0, dataType: 'short', elementSize: 2, elementCount: 8 },
  //   ];
  //   setWatch(mockData);
  // }, [setWatch]); // Dependency array ensures this runs only once.

  return (
    <div className="p-4  text-black dark:text-white h-full font-sans">
      <h2 className="text-xl font-bold mb-3">Watch</h2>
      <div className="overflow-auto">
        <table className="w-full text-sm table-fixed border-collapse">
          {/* Table Head */}
          <thead className="text-left text-gray-500 dark:text-gray-400">
            <tr>
              {/* Using py-2 for vertical padding and no border classes */}
              <th className="py-2 font-semibold w-1/3">File</th>
              <th className="py-2 font-semibold w-1/3">Name</th>
              <th className="py-2 font-semibold w-1/3">Address</th>
              <th className="py-2 font-semibold w-1/4">Type</th>
              <th className="py-2 font-semibold w-1/4">Size</th>
              <th className="py-2 font-semibold w-1/4">HEX</th>
              <th className="py-2 font-semibold w-1/4">CHAR</th>
            </tr>
          </thead>
          {/* Table Body */}
          <tbody>
            {watch.map(row => (
              <tr key={row.name} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                {/* Using py-1 for vertical padding and no border classes */}
                <td className="py-1 font-mono">{row.filePath}</td>
                <td className="py-1 font-mono">{row.name}</td>
                <td className="py-1 font-mono">
                  {/* Displaying address in uppercase hexadecimal format */}
                  {'0x' + row.address.toString(16).toUpperCase()}
                </td>
                <td className="py-1 font-mono">{row.dataType}</td>
                <td className="py-1 font-mono">{row.elementCount}</td>
                <td className="py-1 font-mono">{toHex(row.address)}</td>
                <td className="py-1 font-mono">{toChar(row.address)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
