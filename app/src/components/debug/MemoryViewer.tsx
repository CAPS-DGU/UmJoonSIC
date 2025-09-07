import {
  useMemoryViewStore,
  type MemoryNodeData,
  type MemoryNodeStatus,
  type MemoryLabel,
} from '@/stores/MemoryViewStore';
import { useRegisterStore } from '@/stores/RegisterStore';
import { useEffect, useRef, useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import '/src/styles/SearchAnimation.css';

function MemoryNode({
  node,
  labelHighlight,
  isChanged,
  isSearched,
}: {
  node: MemoryNodeData | null;
  labelHighlight?: boolean;
  isChanged?: boolean;
  isSearched?: boolean;
}) {
  const statusClasses = {
    normal: '',
    highlighted: 'bg-yellow-200',
    'red bold': 'text-red-500 font-bold',
  };

  const val = node?.value || '00';
  const status = node?.status || 'normal';
  const isLoading = node?.isLoading;

  return (
    <span
      className={`font-mono text-sm px-1 w-6 text-center rounded
      ${statusClasses[status]}
      ${labelHighlight ? '!text-orange-500 font-semibold' : ''}
      ${isChanged ? 'memory-flash' : ''}
      ${isSearched ? 'search-flash' : ''}
      ${isLoading ? 'bg-gray-200 animate-pulse' : ''}
      `}
    >
      {val}
    </span>
  );
}

function KeyColumn({
  totalRows,
  visibleRowRange,
  ROW_SIZE,
  ROW_HEIGHT,
}: {
  totalRows: number;
  visibleRowRange: { start: number; end: number };
  ROW_SIZE: number;
  ROW_HEIGHT: number;
}) {
  const visibleRows = [];
  for (let i = visibleRowRange.start; i < visibleRowRange.end; i++) {
    if (i < totalRows) visibleRows.push(i);
  }

  return (
    <div className="flex flex-col gap-2 pr-4 relative">
      {visibleRows.map(rowIndex => {
        const addr = rowIndex * ROW_SIZE;
        return (
          <p
            key={rowIndex}
            className="text-sm font-normal font-mono flex items-center"
            style={{
              height: `${ROW_HEIGHT}px`,
              position: 'absolute',
              top: `${rowIndex * ROW_HEIGHT - 6}px`,
              right: `-15px`,
            }}
          >
            {addr.toString(16).toUpperCase().padStart(4, '0')}
          </p>
        );
      })}
    </div>
  );
}

function ValueColumn({
  totalRows,
  visibleRowRange,
  labels,
  changedNodes,
  memoryValues,
  ROW_SIZE,
  ROW_HEIGHT,
  searchedNodes,
}: {
  totalRows: number;
  visibleRowRange: { start: number; end: number };
  labels: MemoryLabel[];
  changedNodes: Set<number>;
  memoryValues: (MemoryNodeData | null)[];
  ROW_SIZE: number;
  ROW_HEIGHT: number;
  searchedNodes: Set<number>;
}) {
  const visibleRows = [];
  for (let i = visibleRowRange.start; i < visibleRowRange.end; i++) {
    if (i < totalRows) visibleRows.push(i);
  }

  return (
    <div className="flex flex-col gap-2 pl-4 relative">
      {visibleRows.map(rowIndex => {
        const rowStartAddr = rowIndex * ROW_SIZE;
        const rowEndAddr = Math.min(rowStartAddr + ROW_SIZE - 1, totalRows * ROW_SIZE - 1);

        const rowLabels = labels
          .filter(l => l.end >= rowStartAddr && l.start <= rowEndAddr)
          .map(l => ({
            ...l,
            start: Math.max(l.start, rowStartAddr) - rowStartAddr,
            end: Math.min(l.end, rowEndAddr) - rowStartAddr,
          }));

        return (
          <div
            key={rowIndex}
            className="flex flex-col space-y-1 relative"
            style={{
              height: `${ROW_HEIGHT}px`,
              position: 'absolute',
              top: `${rowIndex * ROW_HEIGHT}px`,
            }}
          >
            <div className="flex relative mb-2">
              {Array.from({ length: ROW_SIZE }, (_, idx) => {
                const byteAddr = rowStartAddr + idx;
                const node = memoryValues[byteAddr]; // isLoading 정보 포함
                const label = rowLabels.find(l => idx >= l.start && idx <= l.end);
                const isChanged = changedNodes.has(byteAddr);
                const isSearched = searchedNodes.has(byteAddr);

                return (
                  <MemoryNode
                    key={idx}
                    node={node}
                    labelHighlight={!!label}
                    isChanged={isChanged}
                    isSearched={isSearched}
                  />
                );
              })}

              {/* Label Line */}
              {rowLabels.map((label, idx) => {
                const originalLabel = labels.find(l => l.name === label.name);
                if (!originalLabel) return null;

                const relativeStart = Math.max(originalLabel.start, rowStartAddr) - rowStartAddr;
                const width =
                  (Math.min(originalLabel.end, rowEndAddr) - rowStartAddr - relativeStart + 1) *
                    24 -
                  8;

                return (
                  <div
                    key={`line-${idx}`}
                    className="absolute -bottom-0.5 border-t-2 border-orange-500"
                    style={{ left: relativeStart * 24 + 4, width }}
                  />
                );
              })}

              {/* Label Name */}
              {rowLabels
                .filter(label => {
                  const originalLabel = labels.find(l => l.name === label.name);
                  if (!originalLabel) return false;
                  const labelStartRow = Math.floor(originalLabel.start / ROW_SIZE);
                  return labelStartRow === rowIndex;
                })
                .map((label, idx) => {
                  const left = label.start * 24 + 4;
                  const width = (label.end - label.start + 1) * 24 - 8;
                  return (
                    <div
                      key={`name-${idx}`}
                      className="absolute -bottom-4 text-xs text-orange-500 text-center font-mono"
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

// 메인 컴포넌트
export default function MemoryViewer({ isExecuting }: { isExecuting: boolean }) {
  const memoryValues = useMemoryViewStore(state => state.memoryValues);
  const getMemoryLabelFromWatch = useMemoryViewStore(state => state.getMemoryLabelFromWatch);
  const labels = getMemoryLabelFromWatch();
  const changedNodes = useMemoryViewStore(state => state.changedNodes);
  const clearChangedNodes = useMemoryViewStore(state => state.clearChangedNodes);
  const totalMemorySize = useMemoryViewStore(state => state.totalMemorySize);
  const loadMemoryRange = useMemoryViewStore(state => state.loadMemoryRange);
  const memoryRange = useMemoryViewStore(state => state.memoryRange);
  const pc = useRegisterStore(state => state.PC);
  const containerRef = useRef<HTMLDivElement>(null);
  const ROW_SIZE = 8;
  const BUFFER_SIZE = 512;
  const ROW_HEIGHT = 32;

  const [searchAddress, setSearchAddress] = useState('');
  const [visibleRowRange, setVisibleRowRange] = useState({ start: 0, end: 20 });
  const [searchedNodes, setSearchedNodes] = useState<Set<number>>(new Set());
  const [hasAutoScrolled, setHasAutoScrolled] = useState(false);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (changedNodes.size > 0) {
      const timer = setTimeout(() => {
        clearChangedNodes();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [changedNodes, clearChangedNodes]);

  useEffect(() => {
    if (searchedNodes.size > 0) {
      const timer = setTimeout(() => {
        setSearchedNodes(new Set());
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [searchedNodes]);

  useEffect(() => {
    loadMemoryRange(memoryRange.start, memoryRange.end);
  }, [memoryRange, loadMemoryRange]);

  const handleScroll = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      const startRow = Math.floor(scrollTop / ROW_HEIGHT);
      const endRow = Math.min(
        Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT),
        Math.ceil(totalMemorySize / ROW_SIZE),
      );

      setVisibleRowRange({ start: startRow, end: endRow });

      const visibleStart = startRow * ROW_SIZE;
      const visibleEnd = endRow * ROW_SIZE;

      const loadStart = Math.max(0, visibleStart - BUFFER_SIZE);
      const loadEnd = Math.min(totalMemorySize, visibleEnd + BUFFER_SIZE);

      loadMemoryRange(loadStart, loadEnd);
    }, 150);
  }, [loadMemoryRange, totalMemorySize, ROW_HEIGHT, ROW_SIZE, BUFFER_SIZE]);

  useEffect(() => {
    loadMemoryRange(0, BUFFER_SIZE * 2);
  }, [loadMemoryRange, BUFFER_SIZE]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
      };
    }
  }, [handleScroll]);

  useEffect(() => {
    if (isExecuting && pc >= 0 && pc < totalMemorySize) {
      const loadStart = Math.max(0, pc - BUFFER_SIZE);
      const loadEnd = Math.min(totalMemorySize, pc + BUFFER_SIZE);
      loadMemoryRange(loadStart, loadEnd);
    }
  }, [isExecuting, pc, totalMemorySize, loadMemoryRange, BUFFER_SIZE]);

  const handleSearch = () => {
    if (!containerRef.current || !searchAddress) return;

    const address = parseInt(searchAddress, 16);
    if (isNaN(address) || address < 0 || address >= totalMemorySize) {
      alert('유효하지 않은 메모리 주소입니다.');
      return;
    }

    setSearchedNodes(new Set([address]));

    const rowIndex = Math.floor(address / ROW_SIZE);
    const scrollTo = rowIndex * ROW_HEIGHT;
    containerRef.current.scrollTop = scrollTo;

    const loadStart = Math.max(0, address - BUFFER_SIZE);
    const loadEnd = Math.min(totalMemorySize, address + BUFFER_SIZE);
    loadMemoryRange(loadStart, loadEnd);
  };

  useEffect(() => {
    if (!isExecuting) {
      setHasAutoScrolled(false);
    }
    if (isExecuting && !hasAutoScrolled && pc >= 0 && pc < totalMemorySize) {
      setSearchedNodes(new Set([pc]));
      const rowIndex = Math.floor(pc / ROW_SIZE);
      const scrollTo = rowIndex * ROW_HEIGHT;
      if (containerRef.current) containerRef.current.scrollTop = scrollTo;

      const loadStart = Math.max(0, pc - BUFFER_SIZE);
      const loadEnd = Math.min(totalMemorySize, pc + BUFFER_SIZE);
      loadMemoryRange(loadStart, loadEnd);

      setHasAutoScrolled(true);
    }
  }, [isExecuting, pc, totalMemorySize, loadMemoryRange, hasAutoScrolled, BUFFER_SIZE]);

  const totalRows = Math.ceil(totalMemorySize / ROW_SIZE);

  return (
    <section className="flex flex-col px-2">
      <div className="flex justify-between items-center">
        <h2 className="text-md font-bold">메모리 뷰어</h2>
      </div>

      <div className="flex items-center mt-2 space-x-2">
        <input
          type="text"
          value={searchAddress}
          onChange={e => setSearchAddress(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="memory address"
          className="border border-gray-300 p-1 rounded text-sm w-48 font-mono"
        />
        <button
          onClick={handleSearch}
          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          <Search size={16} />
        </button>
      </div>

      <div
        ref={containerRef}
        className="w-full mt-2 flex justify-start items-start px-2 overflow-y-auto flex-1 min-h-0 h-full max-h-[700px]"
      >
        <div
          className="flex border-r border-gray-300 pr-1 text-green-500"
          style={{ height: `${totalRows * ROW_HEIGHT}px` }}
        >
          <KeyColumn
            totalRows={totalRows}
            visibleRowRange={visibleRowRange}
            ROW_SIZE={ROW_SIZE}
            ROW_HEIGHT={ROW_HEIGHT}
          />
          <div className="flex flex-col text-black">
            <ValueColumn
              totalRows={totalRows}
              visibleRowRange={visibleRowRange}
              labels={labels}
              changedNodes={changedNodes}
              memoryValues={memoryValues}
              ROW_SIZE={ROW_SIZE}
              ROW_HEIGHT={ROW_HEIGHT}
              searchedNodes={searchedNodes}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
