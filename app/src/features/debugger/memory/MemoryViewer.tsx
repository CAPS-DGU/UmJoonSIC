import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  AddressColumn,
  ROW_HEIGHT,
  ROW_SIZE,
  ValueColumn,
  type MemoryLabel,
} from '@/features/debugger/memory/MemoryGrid';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useWatchStore } from '@/features/panel/watchStore';
import '@/features/debugger/memory/searchAnimation.css';

/** Bytes loaded above and below the on-screen (or requested) address. */
const BUFFER_SIZE = 512;
/** How long a changed or searched byte stays highlighted; matches the CSS animation. */
const FLASH_MS = 600;
const SCROLL_DEBOUNCE_MS = 150;

/** The address range around `address`, clipped to the address space. */
function bufferAround(address: number, totalMemorySize: number): [number, number] {
  return [Math.max(0, address - BUFFER_SIZE), Math.min(totalMemorySize, address + BUFFER_SIZE)];
}

/** Address ranges of the watched variables, to mark them with a line in the grid. */
function watchLabels(): MemoryLabel[] {
  // Read without subscribing, as before: the labels follow the viewer's own re-renders.
  const { watch } = useWatchStore.getState();
  const labels: MemoryLabel[] = [];
  watch.forEach(({ address, name, elementCount, elementSize }) => {
    if (typeof address === 'number' && elementCount > 0) {
      labels.push({ start: address, end: address + elementSize * elementCount - 1, name });
    }
  });
  return labels;
}

interface MemoryViewerProps {
  /** During a run: load memory around the PC and scroll to it once. */
  isExecuting: boolean;
}

export default function MemoryViewer({ isExecuting }: MemoryViewerProps) {
  const memoryValues = useMemoryViewStore(state => state.memoryValues);
  const changedNodes = useMemoryViewStore(state => state.changedNodes);
  const clearChangedNodes = useMemoryViewStore(state => state.clearChangedNodes);
  const totalMemorySize = useMemoryViewStore(state => state.totalMemorySize);
  const loadMemoryRange = useMemoryViewStore(state => state.loadMemoryRange);
  const memoryRange = useMemoryViewStore(state => state.memoryRange);
  const pc = useRegisterStore(state => state.PC);
  const labels = watchLabels();

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const [searchAddress, setSearchAddress] = useState('');
  const [visibleRowRange, setVisibleRowRange] = useState({ start: 0, end: 20 });
  const [searchedNodes, setSearchedNodes] = useState<Set<number>>(new Set());
  const [hasAutoScrolled, setHasAutoScrolled] = useState(false);

  // Drop the "changed" highlight once its animation has played.
  useEffect(() => {
    if (changedNodes.size > 0) {
      const timer = setTimeout(() => {
        clearChangedNodes();
      }, FLASH_MS);
      return () => clearTimeout(timer);
    }
  }, [changedNodes, clearChangedNodes]);

  // Same for the "searched" highlight.
  useEffect(() => {
    if (searchedNodes.size > 0) {
      const timer = setTimeout(() => {
        setSearchedNodes(new Set());
      }, FLASH_MS);
      return () => clearTimeout(timer);
    }
  }, [searchedNodes]);

  // Load the program's range whenever it changes (new load, mode switch).
  useEffect(() => {
    loadMemoryRange(memoryRange.start, memoryRange.end);
  }, [memoryRange, loadMemoryRange]);

  // Initial load.
  useEffect(() => {
    loadMemoryRange(0, BUFFER_SIZE * 2);
  }, [loadMemoryRange]);

  // On scroll (debounced): recompute the rows on screen and load memory around them.
  const handleScroll = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      const startRow = Math.floor(container.scrollTop / ROW_HEIGHT);
      const endRow = Math.min(
        Math.ceil((container.scrollTop + container.clientHeight) / ROW_HEIGHT),
        Math.ceil(totalMemorySize / ROW_SIZE),
      );
      setVisibleRowRange({ start: startRow, end: endRow });

      const loadStart = Math.max(0, startRow * ROW_SIZE - BUFFER_SIZE);
      const loadEnd = Math.min(totalMemorySize, endRow * ROW_SIZE + BUFFER_SIZE);
      loadMemoryRange(loadStart, loadEnd);
    }, SCROLL_DEBOUNCE_MS);
  }, [loadMemoryRange, totalMemorySize]);

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

  // During a run, keep memory around the PC loaded.
  useEffect(() => {
    if (isExecuting && pc >= 0 && pc < totalMemorySize) {
      loadMemoryRange(...bufferAround(pc, totalMemorySize));
    }
  }, [isExecuting, pc, totalMemorySize, loadMemoryRange]);

  const scrollToAddress = (address: number) => {
    setSearchedNodes(new Set([address]));
    if (containerRef.current) {
      containerRef.current.scrollTop = Math.floor(address / ROW_SIZE) * ROW_HEIGHT;
    }
    loadMemoryRange(...bufferAround(address, totalMemorySize));
  };

  const handleSearch = () => {
    if (!containerRef.current || !searchAddress) return;

    const address = parseInt(searchAddress, 16);
    if (isNaN(address) || address < 0 || address >= totalMemorySize) {
      alert('유효하지 않은 메모리 주소입니다.');
      return;
    }
    scrollToAddress(address);
  };

  // When a run starts, jump to the PC once.
  useEffect(() => {
    if (!isExecuting) {
      setHasAutoScrolled(false);
    }
    if (isExecuting && !hasAutoScrolled && pc >= 0 && pc < totalMemorySize) {
      scrollToAddress(pc);
      setHasAutoScrolled(true);
    }
    // scrollToAddress is recreated on every render; its inputs are listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExecuting, pc, totalMemorySize, loadMemoryRange, hasAutoScrolled]);

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
          <AddressColumn totalRows={totalRows} visibleRowRange={visibleRowRange} />
          <div className="flex flex-col text-black">
            <ValueColumn
              totalRows={totalRows}
              visibleRowRange={visibleRowRange}
              labels={labels}
              memoryValues={memoryValues}
              changedNodes={changedNodes}
              searchedNodes={searchedNodes}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
