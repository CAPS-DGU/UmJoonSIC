import { useEditorTabStore } from '@/features/editor/editorTabStore';

/** Bottom bar: cursor position of the active tab. Hidden while no tab is open. */
export default function StatusBar() {
  const { getActiveTab } = useEditorTabStore();
  const activeTab = getActiveTab();

  if (!activeTab) {
    return null;
  }

  return (
    <div className="bg-red-500 flex flex-row justify-between text-white px-2">
      <span>{`Ln ${activeTab.cursor.line}, Col ${activeTab.cursor.column}`}</span>
    </div>
  );
}
