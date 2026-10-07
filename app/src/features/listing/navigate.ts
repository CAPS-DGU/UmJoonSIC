// Ways into and out of the run's listing (the one List tab, with a mini-tab per file):
//   a Watch variable    → its row in the listing (running) or its line in the source (not),
//                         and its bytes in the memory viewer;
//   an address          → the row whose code or data holds it (memory, the PC, a last write);
//   a listing row       → its line in the source file (and back: "Show in listing");
//   a symbol (operand)  → the row that defines it, and its bytes in memory.
import { useMemoryViewStore } from '@/features/debugger/memory/memoryViewStore';
import { useRunningStore } from '@/features/debugger/runningStore';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import {
  LISTING_TAB,
  rowAddress,
  rowAtAddress,
  rowDefining,
  rowOfSourceLine,
  sourceLineOfRow,
  useListingStore,
} from '@/features/listing/listingStore';
import type { WatchRow } from '@/features/panel/watchStore';
import { useProjectStore } from '@/features/project/projectStore';
import { strings } from '@/i18n';
import { resolveInProject, toProjectRelativePath } from '@/lib/projectPath';

let revealId = 0;

/** Open the List tab on `filePath`'s listing; with `rowIndex`, scroll to that row and mark it. */
export async function showInListing(filePath: string, rowIndex?: number) {
  const store = useListingStore.getState();
  if (!store.listings.some(l => l.filePath === filePath)) return;
  store.setActiveFile(filePath);
  if (rowIndex !== undefined) {
    useListingStore.setState({ revealRequest: { filePath, rowIndex, id: ++revealId } });
  }
  await useEditorTabStore
    .getState()
    .openTab({ title: strings().tabs.listingTab, filePath: LISTING_TAB });
}

/** Show the row whose code or data holds `address`; false if no listing has it. */
export async function showAddressInListing(address: number) {
  const at = rowAtAddress(useListingStore.getState().listings, address);
  if (!at) return false;
  await showInListing(at.filePath, at.rowIndex);
  return true;
}

/** A source file's text: as in its open tab (unsaved edits too), else from the disk. */
async function sourceText(relative: string) {
  const tab = useEditorTabStore.getState().tabs.find(t => t.filePath === relative);
  if (tab) return tab.content;
  const { projectPath } = useProjectStore.getState();
  const res = await window.api.readFile(resolveInProject(projectPath, relative));
  return res.success ? (res.data ?? '') : '';
}

const tabTitle = (path: string) => path.split(/[/\\]/).pop()!;

/** Open a source file at a line. */
async function openSourceAt(relative: string, line: number) {
  await useEditorTabStore
    .getState()
    .openTab({ title: tabTitle(relative), filePath: relative, cursor: { line, column: 1 } });
}

/** A listing row's line in its source file (the file the listing came from). */
export async function showSourceOfRow(filePath: string, rowIndex: number) {
  const listing = useListingStore.getState().listings.find(l => l.filePath === filePath);
  if (!listing) return;
  const relative = toProjectRelativePath(useProjectStore.getState().projectPath, filePath);
  const line = sourceLineOfRow(listing.rows, await sourceText(relative), rowIndex);
  await openSourceAt(relative, line ?? 1);
}

/** A source line's row in the listing (the editor's "Show in listing"); false if none. */
export async function showSourceLineInListing(relative: string, line: number) {
  const { projectPath } = useProjectStore.getState();
  const absolute = resolveInProject(projectPath, relative);
  const listing = useListingStore
    .getState()
    .listings.find(
      l => l.filePath === absolute || toProjectRelativePath(projectPath, l.filePath) === relative,
    );
  if (!listing) return false;
  const rowIndex = rowOfSourceLine(listing.rows, await sourceText(relative), line);
  await showInListing(listing.filePath, rowIndex ?? undefined);
  return rowIndex !== null;
}

/** A symbol of the program (an operand): the row that defines it, and its bytes in memory. */
export async function showSymbol(label: string, fromFile?: string) {
  const symbol = label
    .replace(/^[#@=+]/, '')
    .split(',')[0]
    .trim();
  if (!symbol) return false;
  const found = rowDefining(useListingStore.getState().listings, symbol, fromFile);
  if (!found) return false;
  await showInListing(found.filePath, found.rowIndex);
  const row = useListingStore.getState().listings.find(l => l.filePath === found.filePath)!.rows[
    found.rowIndex
  ];
  useMemoryViewStore.getState().reveal(rowAddress(row), 1);
  return true;
}

/**
 * A Watch variable: while a program runs, its row in the listing; otherwise the line that
 * defines it in the source. Its bytes are shown in the memory viewer either way.
 */
export async function showVariable(row: WatchRow) {
  useMemoryViewStore
    .getState()
    .reveal(row.address, Math.max(1, row.elementCount * row.elementSize));
  const { isRunning } = useRunningStore.getState();
  const { listings } = useListingStore.getState();
  if (isRunning && listings.length > 0) {
    const found = rowDefining(listings, row.name, row.filePath);
    if (found) {
      await showInListing(found.filePath, found.rowIndex);
      return;
    }
  }
  const relative = toProjectRelativePath(useProjectStore.getState().projectPath, row.filePath);
  const lines = (await sourceText(relative)).split(/\r?\n/);
  const pattern = new RegExp(`^${row.name.replace(/[$^.*+?()[\]{}|\\]/g, '\\$&')}\\s`, 'i');
  const index = lines.findIndex(l => pattern.test(l));
  await openSourceAt(relative, index >= 0 ? index + 1 : 1);
}
