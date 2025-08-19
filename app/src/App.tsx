import SideBar from "@/components/common/SideBar";
import ToolBar from "@/components/common/ToolBar";
import UnderStatusBar from "@/components/common/UnderStatusBar";
import CodeEditor from "@/components/editor/CodeEditor";
import Debug from "@/components/debug";


function App() {
  return (
    <div className="flex h-screen w-screen flex-col">
      <ToolBar />
      <div className="flex h-full w-full">
        <SideBar />
        <CodeEditor />
        <Debug />
      </div>
      <UnderStatusBar />
    </div>
  );
}

export default App;