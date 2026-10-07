import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useStrings } from '@/i18n';
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

  // A changed byte stays tinted until the next step (lib/changeMarks.ts): its value is what
  // the student looks for after stepping.

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

  const t = useStrings();
  const [searchError, setSearchError] = useState('');

  /**
   * An address in hex (with or without 0x), or a label of the loaded program (its variables).
   * A wrong entry is said under the field (it was a browser alert).
   */
  const handleSearch = () => {
    if (!containerRef.current) return;
    const text = searchAddress.trim();
    if (!text) return;
    const variable = useWatchStore
      .getState()
      .watch.find(v => v.name.toUpperCase() === text.toUpperCase());
    const address = variable
      ? variable.address
      : /^(0x)?[0-9a-f]+$/i.test(text)
        ? parseInt(text.replace(/^0x/i, ''), 16)
        : NaN;
    if (isNaN(address) || address < 0 || address >= totalMemorySize) {
      setSearchError(t.memory.invalid(text));
      return;
    }
    setSearchError('');
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
        <h2 className="text-sm font-semibold">{t.memory.title}</h2>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={searchAddress}
          onChange={e => {
            setSearchAddress(e.target.value);
            setSearchError('');
          }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder={t.memory.placeholder}
          aria-label={t.memory.placeholder}
          aria-invalid={!!searchError}
          className={`${FORM_FIELD} min-w-0 flex-1 font-mono text-sm`}
        />
        <button
          onClick={handleSearch}
          className="inline-flex h-7 shrink-0 items-center justify-center rounded-md bg-blue-600 px-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          title={t.memory.goTitle}
        >
          {t.memory.go}
        </button>
      </div>
      {searchError && (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {searchError}
        </p>
      )}

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
