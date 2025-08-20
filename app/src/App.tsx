import SideBar, { convertToFileStructure, type FileStructure } from "@/components/common/SideBar";
import ToolBar from "@/components/common/ToolBar";
import UnderStatusBar from "@/components/common/UnderStatusBar";
import Debug from "@/components/debug";
import EditorContainer from "./components/editor/EditorContainer";
import { useProjectStore } from "./stores/ProjectStore";
import { useEffect } from "react";


function App() {
  const { createNewProject } = useProjectStore();

    

  useEffect(() => {
    // 새 프로젝트 생성 이벤트 리스너
    const handleCreateNewProject = () => {
      createNewProject();
    };

    window.addEventListener('create-new-project', handleCreateNewProject);

    return () => {
      window.removeEventListener('create-new-project', handleCreateNewProject);
    };
  }, [createNewProject]);
  return (
    <div className="flex h-screen w-screen flex-col">
      {/* <ToolBar /> */}
      <div className="flex w-full h-full">
        <SideBar />
        <EditorContainer />
        <Debug />
      </div>
      <UnderStatusBar />
    </div>
  );
}

export default App;