import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  File,
  FileCode,
  FileText,
  ScrollText,
  Settings,
  X,
} from 'lucide-react';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { requestCloseTab } from '@/features/editor/unsavedChanges';
import { listingOfTab, useListingStore } from '@/features/listing/listingStore';
import { useStrings } from '@/i18n';
import { INLINE_ICON_BUTTON } from '@/lib/controls';

/** Where a dragged tab would go: before or after the tab under the pointer. */
interface DropTarget {
  filePath: string;
  after: boolean;
}

/** The same icons as the file tree; a listing has its own (it was a source file's icon). */
const getFileIcon = (filePath: string) => {
  const lower = filePath.toLowerCase();
  if (lower === 'project.sic')
    return <Settings width={16} height={16} className="shrink-0 text-gray-700" />;
  if (lower.endsWith('.lst'))
    return <ScrollText width={16} height={16} className="shrink-0 text-blue-700" />;
  if (lower.endsWith('.asm'))
    return <FileCode width={16} height={16} className="shrink-0 text-green-700" />;
  if (lower.endsWith('.txt'))
    return <FileText width={16} height={16} className="shrink-0 text-gray-700" />;
  return <File width={16} height={16} className="shrink-0 text-gray-700" />;
};

/** Is the strip scrolled away from its start / its end (then an arrow shows on that side)? */
function useOverflow(strip: HTMLDivElement | null, deps: unknown) {
  const [overflow, setOverflow] = useState({ left: false, right: false });
  useEffect(() => {
    if (!strip) return;
    const update = () =>
      setOverflow({
        left: strip.scrollLeft > 1,
        right: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
      });
    update();
    strip.addEventListener('scroll', update);
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    return () => {
      strip.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [strip, deps]);
  return overflow;
}

/** Open tabs; drag a tab to move it. While a program runs, a button re-opens its List tabs. */
export default function TabBar() {
  const t = useStrings();
  const listings = useListingStore(state => state.listings);
  // A listing tab is named in the current language (its title was set when it opened).
  const tabLabel = (title: string, filePath: string) => {
    const listing = listingOfTab(listings, filePath);
    return listing ? t.tabs.listing(listing.filePath.split(/[/\\]/).pop()!) : title;
  };
  const tabs = useEditorTabStore(state => state.tabs);
  const activePath = useEditorTabStore(state => state.activePath);
  const activateTab = useEditorTabStore(state => state.activateTab);
  const moveTab = useEditorTabStore(state => state.moveTab);
  const isRunning = useRunningStore(state => state.isRunning);
  const showListings = useRunningStore(state => state.showListings);

  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [strip, setStrip] = useState<HTMLDivElement | null>(null);

  // Keep the active tab in sight when it changes by keyboard (Ctrl+PageDown) or a move.
  const tabOrder = tabs.map(tab => tab.filePath).join('\n');
  const overflow = useOverflow(strip, tabOrder);
  const scrollStrip = (direction: 1 | -1) =>
    strip?.scrollBy({
      left: direction * Math.max(160, strip.clientWidth * 0.6),
      behavior: 'smooth',
    });
  const arrow =
    'flex w-6 shrink-0 items-center justify-center border-gray-300 text-gray-700 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30';
  // Both arrows while the tabs do not fit (the one at an end disabled): the strip keeps its
  // width as it scrolls, so a tab does not slide under an arrow that just appeared.
  const overflowing = overflow.left || overflow.right;
  useEffect(() => {
    if (!activePath || !strip) return;
    const tabOf = () =>
      strip.querySelector<HTMLElement>(`[data-tab-path="${CSS.escape(activePath)}"]`);
    const reveal = () => tabOf()?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    reveal();
    // Also when the strip changes width (the arrows or the Listing button appear, the window
    // is resized): the active tab was left half under an arrow. Scrolling with the arrows does
    // not change the width (both show while the tabs overflow), so this does not undo it.
    const observer = new ResizeObserver(reveal);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [activePath, tabOrder, strip]);

  const endDrag = () => {
    setDraggedPath(null);
    setDropTarget(null);
  };

  /** Where a drop at this point of this tab puts the dragged tab. */
  const targetAt = (event: DragEvent<HTMLElement>, filePath: string): DropTarget => {
    const box = event.currentTarget.getBoundingClientRect();
    return { filePath, after: event.clientX > box.left + box.width / 2 };
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>, filePath: string) => {
    // Only tabs are dropped here (not files dragged in from elsewhere).
    if (!draggedPath) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const target = targetAt(event, filePath);
    if (dropTarget?.filePath !== target.filePath || dropTarget.after !== target.after) {
      setDropTarget(target);
    }
  };

  /** Put the dragged tab before or after the target (worked out from the drop itself). */
  const dropOn = (target: DropTarget) => {
    const current = useEditorTabStore.getState().tabs;
    const from = current.findIndex(tab => tab.filePath === draggedPath);
    let to = current.findIndex(tab => tab.filePath === target.filePath);
    if (draggedPath && from >= 0 && to >= 0) {
      if (target.after) to += 1;
      // The dragged tab leaves its place first.
      if (from < to) to -= 1;
      moveTab(draggedPath, to);
    }
    endDrag();
  };

  // The empty part of the strip, after the last tab: drop there to move a tab to the end.
  const lastTab = tabs.at(-1);
  const isOnStrip = (event: DragEvent<HTMLDivElement>) => event.target === event.currentTarget;

  const dropMarker = (filePath: string) => {
    if (dropTarget?.filePath !== filePath || draggedPath === filePath) return '';
    return dropTarget.after
      ? 'shadow-[inset_-2px_0_0_var(--color-blue-500)]'
      : 'shadow-[inset_2px_0_0_var(--color-blue-500)]';
  };

  return (
    <div className="@container flex h-10 shrink-0 flex-row bg-white border-b border-gray-300">
      {/* When the tabs do not fit, arrows show that there are more (they were cut silently). */}
      {overflowing && (
        <button
          className={`${arrow} border-r`}
          disabled={!overflow.left}
          onClick={() => scrollStrip(-1)}
          title={t.tabs.scrollLeft}
          aria-label={t.tabs.scrollLeft}
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      <div
        ref={element => {
          stripRef.current = element;
          setStrip(element);
        }}
        // Tabs keep a readable width; when they do not fit, the strip scrolls: with the mouse
        // wheel, Ctrl+PageDown/PageUp, and to the active tab. No scrollbar: it would take the
        // tabs' height.
        className="no-scrollbar flex flex-row flex-1 min-w-0 overflow-x-auto"
        onWheel={event => {
          const strip = event.currentTarget;
          const vertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);
          if (vertical && strip.scrollWidth > strip.clientWidth) {
            strip.scrollLeft += event.deltaY;
          }
        }}
        onDragOver={event => {
          if (!draggedPath || !lastTab || !isOnStrip(event)) return;
          event.preventDefault();
          if (dropTarget?.filePath !== lastTab.filePath || !dropTarget.after) {
            setDropTarget({ filePath: lastTab.filePath, after: true });
          }
        }}
        onDrop={event => {
          if (!draggedPath || !lastTab || !isOnStrip(event)) return;
          event.preventDefault();
          dropOn({ filePath: lastTab.filePath, after: true });
        }}
        onDragLeave={event => {
          // Out of the strip altogether (not just onto one of its tabs): no drop marker.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDropTarget(null);
        }}
      >
        {tabs.map(tab => (
          <div
            key={tab.filePath}
            data-tab-path={tab.filePath}
            draggable
            onDragStart={event => {
              event.dataTransfer.effectAllowed = 'move';
              setDraggedPath(tab.filePath);
            }}
            onDragOver={event => onDragOver(event, tab.filePath)}
            onDrop={event => {
              if (!draggedPath) return;
              event.preventDefault();
              event.stopPropagation();
              dropOn(targetAt(event, tab.filePath));
            }}
            onDragEnd={endDrag}
            className={`flex shrink-0 items-center min-w-28 max-w-64 border-r border-gray-300 transition-colors ${
              tab.filePath === activePath
                ? 'bg-gray-200 border-b-0'
                : 'bg-gray-50 hover:bg-gray-200'
            } ${draggedPath === tab.filePath ? 'opacity-50' : ''} ${dropMarker(tab.filePath)}`}
          >
            <button
              onClick={() => activateTab(tab.filePath)}
              className="flex h-full items-center gap-1 px-3 min-w-0 flex-1"
              title={tab.filePath}
            >
              {getFileIcon(tab.filePath)}
              <span className="truncate text-sm font-medium">
                {tabLabel(tab.title, tab.filePath)}
              </span>
              <span
                className={`text-red-700 text-xs ml-1 transition-opacity duration-200 ${
                  tab.isModified ? 'opacity-100' : 'opacity-0'
                }`}
              >
                ●
              </span>
            </button>
            <button
              onClick={() => requestCloseTab(tab.filePath)}
              className={`${INLINE_ICON_BUTTON} mr-1`}
              title={t.tabs.close}
              aria-label={t.tabs.close}
            >
              <X width={12} height={12} />
            </button>
          </div>
        ))}
      </div>
      {overflowing && (
        <button
          className={`${arrow} border-l`}
          disabled={!overflow.right}
          onClick={() => scrollStrip(1)}
          title={t.tabs.scrollRight}
          aria-label={t.tabs.scrollRight}
        >
          <ChevronRight className="size-4" />
        </button>
      )}
      {isRunning && (
        <button
          onClick={() => void showListings()}
          className="flex items-center gap-1 px-3 shrink-0 border-l border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
          title={t.tabs.showListingTitle}
        >
          <ScrollText width={16} height={16} />
          {/* A narrow bar keeps the room for the tabs (the title still names the button). */}
          <span className="@max-[30rem]:sr-only">{t.tabs.showListing}</span>
        </button>
      )}
    </div>
  );
}
