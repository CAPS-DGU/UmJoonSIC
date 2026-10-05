import { selectActiveTab, useEditorTabStore } from '@/features/editor/editorTabStore';

/** Bottom bar: cursor position of the active tab (empty while no tab is open). */
export default function StatusBar() {
  const activeTab = useEditorTabStore(selectActiveTab);

  // Always shown, so the layout does not jump when the last tab closes.
  return (
    <div className="flex h-6 shrink-0 items-center justify-between bg-red-500 px-2 text-xs text-white">
      <span>{activeTab ? `Ln ${activeTab.cursor.line}, Col ${activeTab.cursor.column}` : ''}</span>
    </div>
  );
}
