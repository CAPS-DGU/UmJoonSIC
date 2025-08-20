import { useEditorTabStore } from "@/stores/EditorTabStore";
import { File, X } from "lucide-react";

export default function TabBar() {
    const { tabs, closeTab, setActiveTab } = useEditorTabStore();
    return (
        <div className="flex flex-row">
            {tabs.map((tab) => (
                <div key={tab.filePath} className={`flex flex-row p-1 ${tab.isActive ? "bg-gray-200" : ""}`}>
                    <div className="flex flex-row">
                        <button onClick={() => setActiveTab(tab.idx)} className="hover:bg-gray-200 flex flex-row"><File width={16} height={16} /> {tab.title} </button>
                        <button onClick={() => closeTab(tab.idx)} className="hover:bg-gray-200"><X width={16} height={16} /></button>
                    </div>
                </div>
            ))}
        </div>
    );
}