import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  addressDigits,
  gridWidth,
  ROW_HEIGHT,
  ROW_SIZE,
} from '@/features/debugger/memory/gridLayout';
import {
  MemoryRows,
  type MemoryCellValue,
  type MemoryLabel,
} from '@/features/debugger/memory/MemoryGrid';
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRegisterStore } from '@/features/debugger/registerStore';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useWatchStore } from '@/features/panel/watchStore';
import '@/features/debugger/memory/searchAnimation.css';
import { FORM_FIELD } from '@/lib/controls';

/** Bytes read above and below the rows on screen, so that short scrolls show values at once. */
const MARGIN = 512;
/** How long a changed or searched byte stays highlighted; matches the CSS animation. */
const FLASH_MS = 600;
const SCROLL_DEBOUNCE_MS = 150;

export default function MemoryViewer() {
  const bytes = useMemoryViewStore(state => state.bytes);
  const failed = useMemoryViewStore(state => state.failed);
  const isLoading = useMemoryViewStore(state => state.pendingReads > 0);
  const changedNodes = useMemoryViewStore(state => state.changedNodes);
  const clearChangedNodes = useMemoryViewStore(state => state.clearChangedNodes);
  const totalMemorySize = useMemoryViewStore(state => state.totalMemorySize);
  const setViewRange = useMemoryViewStore(state => state.setViewRange);
  const isRunning = useRunningStore(state => state.isRunning);
  const pc = useRegisterStore(state => state.PC);
  const watch = useWatchStore(state => state.watch);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const [searchAddress, setSearchAddress] = useState('');
  const [visibleRowRange, setVisibleRowRange] = useState({ start: 0, end: 20 });
  const [searchedNodes, setSearchedNodes] = useState<Set<number>>(new Set());

  /** The watched variables, marked in the grid. */
  const labels = useMemo<MemoryLabel[]>(
    () =>
      watch
        .filter(({ elementCount }) => elementCount > 0)
        .map(({ address, name, elementCount, elementSize }) => ({
          start: address,
          end: address + elementSize * elementCount - 1,
          name,
        })),
    [watch],
  );

  const cellAt = useCallback(
    (address: number): MemoryCellValue => {
      if (failed.has(address)) return { value: 'ER' };
      const value = bytes.get(address);
      if (value === undefined) return { value: '00', isLoading };
      return { value: value.toString(16).toUpperCase().padStart(2, '0') };
    },
    [bytes, failed, isLoading],
  );

  // Drop the "changed" highlight once its animation has played.
  useEffect(() => {
    if (changedNodes.size > 0) {
      const timer = setTimeout(clearChangedNodes, FLASH_MS);
      return () => clearTimeout(timer);
    }
  }, [changedNodes, clearChangedNodes]);

  // Same for the "searched" highlight.
  useEffect(() => {
    if (searchedNodes.size > 0) {
      const timer = setTimeout(() => setSearchedNodes(new Set()), FLASH_MS);
      return () => clearTimeout(timer);
    }
  }, [searchedNodes]);

  /** Read the rows on screen (with the margin). After a run, bytes already shown are kept. */
  const showRowsOnScreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const startRow = Math.floor(container.scrollTop / ROW_HEIGHT);
    const endRow = Math.min(
      Math.ceil((container.scrollTop + container.clientHeight) / ROW_HEIGHT),
      Math.ceil(totalMemorySize / ROW_SIZE),
    );
    setVisibleRowRange({ start: startRow, end: endRow });
    void setViewRange(
      { start: startRow * ROW_SIZE - MARGIN, end: endRow * ROW_SIZE + MARGIN },
      { keepKnown: !useRunningStore.getState().isRunning },
    );
  }, [setViewRange, totalMemorySize]);

  // At first, and whenever the address space changes (mode switch).
  useEffect(showRowsOnScreen, [showRowsOnScreen]);

  // When the viewer changes size (window, bottom panel, divider), other rows are on screen.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(showRowsOnScreen, SCROLL_DEBOUNCE_MS);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [showRowsOnScreen]);

  // On scroll (debounced).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(showRowsOnScreen, SCROLL_DEBOUNCE_MS);
    };
    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [showRowsOnScreen]);

  const scrollToAddress = useCallback(
    (address: number) => {
      setSearchedNodes(new Set([address]));
      if (containerRef.current) {
        containerRef.current.scrollTop = Math.floor(address / ROW_SIZE) * ROW_HEIGHT;
      }
      showRowsOnScreen();
    },
    [showRowsOnScreen],
  );

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
  const [hasScrolledToPc, setHasScrolledToPc] = useState(false);
  useEffect(() => {
    if (!isRunning) {
      setHasScrolledToPc(false);
    } else if (!hasScrolledToPc && pc >= 0 && pc < totalMemorySize) {
      scrollToAddress(pc);
      setHasScrolledToPc(true);
    }
  }, [isRunning, pc, totalMemorySize, hasScrolledToPc, scrollToAddress]);

  const totalRows = Math.ceil(totalMemorySize / ROW_SIZE);
  const digits = addressDigits(totalMemorySize);

  return (
    <section className="flex flex-1 min-h-0 flex-col px-2">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold">메모리 뷰어</h2>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={searchAddress}
          onChange={e => setSearchAddress(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="memory address"
          className={`${FORM_FIELD} min-w-0 flex-1 font-mono text-sm`}
        />
        <button
          onClick={handleSearch}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-500 text-white transition-colors hover:bg-blue-600"
          title="이 주소로 이동"
        >
          <Search size={16} />
        </button>
      </div>

      <div
        ref={containerRef}
        className="slim-scroll mt-2 flex-1 min-h-0 overflow-y-auto font-mono text-sm"
      >
        <div
          className="relative"
          style={{ height: totalRows * ROW_HEIGHT, minWidth: gridWidth(digits) }}
        >
          <MemoryRows
            totalRows={totalRows}
            visibleRowRange={visibleRowRange}
            digits={digits}
            labels={labels}
            cellAt={cellAt}
            changedNodes={changedNodes}
            searchedNodes={searchedNodes}
          />
        </div>
      </div>
    </section>
  );
}
