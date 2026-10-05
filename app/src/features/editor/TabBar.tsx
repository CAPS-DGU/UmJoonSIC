import { useEffect, useRef, useState, type DragEvent } from 'react';
import { File, ListOrdered, Settings, X } from 'lucide-react';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { requestCloseTab } from '@/features/editor/unsavedChanges';

/** Where a dragged tab would go: before or after the tab under the pointer. */
interface DropTarget {
  filePath: string;
  after: boolean;
}

const getFileIcon = (fileName: string) => {
  if (fileName.toLowerCase() === 'project.sic') {
    return <Settings width={14} height={14} className="text-blue-500" />;
  }
  if (fileName.toLowerCase().endsWith('.asm')) {
    return <File width={14} height={14} className="text-green-500" />;
  }
  return <File width={14} height={14} className="text-gray-500" />;
};

/** Open tabs; drag a tab to move it. While a program runs, a button re-opens its List tabs. */
export default function TabBar() {
  const tabs = useEditorTabStore(state => state.tabs);
  const activePath = useEditorTabStore(state => state.activePath);
  const activateTab = useEditorTabStore(state => state.activateTab);
  const moveTab = useEditorTabStore(state => state.moveTab);
  const isRunning = useRunningStore(state => state.isRunning);
  const showListings = useRunningStore(state => state.showListings);

  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Keep the active tab in sight when it changes by keyboard (Ctrl+PageDown) or a move.
  const tabOrder = tabs.map(tab => tab.filePath).join('\n');
  useEffect(() => {
    if (!activePath) return;
    const tab = stripRef.current?.querySelector(`[data-tab-path="${CSS.escape(activePath)}"]`);
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activePath, tabOrder]);

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
    <div className="flex flex-row bg-white border-b border-gray-300">
      <div
        ref={stripRef}
        className="flex flex-row flex-1 min-w-0 overflow-x-auto"
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
            className={`flex items-center min-w-0 max-w-48 border-r border-gray-300 transition-colors ${
              tab.filePath === activePath
                ? 'bg-gray-200 border-b-0'
                : 'bg-gray-50 hover:bg-gray-200'
            } ${draggedPath === tab.filePath ? 'opacity-50' : ''} ${dropMarker(tab.filePath)}`}
          >
            <button
              onClick={() => activateTab(tab.filePath)}
              className="flex items-center gap-1 px-3 py-2 min-w-0 flex-1"
            >
              {getFileIcon(tab.title)}
              <span className="truncate text-sm font-medium">{tab.title}</span>
              <span
                className={`text-red-500 text-xs ml-1 transition-opacity duration-200 ${
                  tab.isModified ? 'opacity-100' : 'opacity-0'
                }`}
              >
                ●
              </span>
            </button>
            <button
              onClick={() => requestCloseTab(tab.filePath)}
              className="p-1 rounded mr-1 "
              title="Close tab"
            >
              <X width={12} height={12} className="text-gray-500 hover:text-gray-700" />
            </button>
          </div>
        ))}
      </div>
      {isRunning && (
        <button
          onClick={() => void showListings()}
          className="flex items-center gap-1 px-3 shrink-0 border-l border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-100"
          title="리스트 보기 (닫은 List 탭 다시 열기)"
        >
          <ListOrdered width={14} height={14} />
          List
        </button>
      )}
    </div>
  );
}
