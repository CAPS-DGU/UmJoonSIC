/** 하단 상태바 */

import { useEditorTabStore } from "@/stores/EditorTabStore";

export default function UnderStatusBar() {

  const { getActiveTab } = useEditorTabStore();
  const activeTab = getActiveTab();

  if (!activeTab) {
    return null;
  }

  return (
    <div className="bg-red-500 flex flex-row justify-between text-white px-2">
      <span>{`Ln ${activeTab.cursor.line}, Col ${activeTab.cursor.column}`}</span>
    </div>
  )
}
