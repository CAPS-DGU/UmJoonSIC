import { useEditorTabStore } from "@/stores/EditorTabStore";

export default function TabBar() {
    const { tabs, closeTab, setActiveTab } = useEditorTabStore();
    return (
        <div className="flex flex-row">
            {tabs.map((tab, index) => (
                <button key={index} onClick={() => setActiveTab(index)} className="flex flex-row">
                    <div>{tab.title} <button onClick={() => closeTab(index)}>X</button></div>
                </button>
            ))}
        </div>
    );
}