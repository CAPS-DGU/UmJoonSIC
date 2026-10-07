import { PenLine } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { simulator } from '@/api/simulator';
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
import { useLastWriteStore } from '@/features/debugger/lastWrite';
import { formatAddress, useRunningStore } from '@/features/debugger/runningStore';
import { showAddressInListing } from '@/features/listing/navigate';
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

  /**
   * Show `size` bytes at `address`: scrolled to (a third from the top) only if not all on
   * screen, then highlighted like a search result.
   */
  const revealAddress = useCallback(
    (address: number, size: number) => {
      const container = containerRef.current;
      if (!container) return;
      const first = Math.floor(address / ROW_SIZE);
      const last = Math.floor((address + size - 1) / ROW_SIZE);
      const top = container.scrollTop / ROW_HEIGHT;
      const bottom = (container.scrollTop + container.clientHeight) / ROW_HEIGHT;
      if (first < top || last + 1 > bottom) {
        container.scrollTop = Math.max(0, first * ROW_HEIGHT - container.clientHeight / 3);
      }
      setSearchedNodes(new Set(Array.from({ length: Math.min(size, 64) }, (_, i) => address + i)));
      showRowsOnScreen();
    },
    [showRowsOnScreen],
  );

  // Requests from elsewhere: a Watch variable, the last write, a symbol in the listing.
  const revealRequest = useMemoryViewStore(state => state.revealRequest);
  useEffect(() => {
    if (revealRequest) revealAddress(revealRequest.address, revealRequest.size);
  }, [revealRequest, revealAddress]);

  const lastWrite = useLastWriteStore(state => state.last);
  /** Show the bytes the last store instruction wrote (through its pointer, for STA @P). */
  const showLastWrite = async () => {
    if (!lastWrite) return;
    let address = lastWrite.address;
    if (lastWrite.indirect) {
      try {
        const { values } = await simulator.memory(address, address + 2);
        address = (values[0] << 16) | (values[1] << 8) | values[2];
      } catch {
        // The pointer could not be read: show where it is.
      }
    }
    revealAddress(address, lastWrite.size);
  };

  /** A byte double-clicked while a program runs: the listing row that holds it. */
  const onGridDoubleClick = (event: React.MouseEvent) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-memory-address]');
    if (!cell || !useRunningStore.getState().isRunning) return;
    void showAddressInListing(Number(cell.dataset.memoryAddress));
  };

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
      {/* Where the last store instruction wrote: one click shows it (it may be far off screen). */}
      {lastWrite && (
        <button
          type="button"
          className="mt-1 inline-flex min-w-0 items-center gap-1 self-start rounded px-1 text-xs text-gray-700 hover:bg-gray-200"
          title={t.memory.lastWriteTitle(lastWrite.instruction, formatAddress(lastWrite.pc))}
          onClick={() => void showLastWrite()}
          data-last-write={lastWrite.address}
        >
          <PenLine className="size-3.5 shrink-0 text-orange-700" aria-hidden />
          <span className="truncate">
            {t.memory.lastWrite(
              lastWrite.indirect
                ? `@${formatAddress(lastWrite.address)}`
                : formatAddress(lastWrite.address),
              lastWrite.size,
            )}
          </span>
        </button>
      )}
      {searchError && (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {searchError}
        </p>
      )}

      <div
        ref={containerRef}
        className="slim-scroll mt-2 flex-1 min-h-0 overflow-y-auto font-mono text-sm"
        onDoubleClick={onGridDoubleClick}
        title={isRunning ? t.memory.gridTitle : undefined}
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
