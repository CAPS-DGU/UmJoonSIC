import SideBar from "@/components/common/SideBar";
import ToolBar from "@/components/common/ToolBar";
import UnderStatusBar from "@/components/common/UnderStatusBar";
import Debug from "@/components/debug";
import EditorContainer from "./components/editor/EditorContainer";
import { useProjectStore } from "./stores/ProjectStore";
import { useEffect } from "react";


function App() {
  const { createNewProject, projectName } = useProjectStore();


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

  if (projectName === "") {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-bold">아직 프로젝트를 생성하지 않았습니다.</h1>
        <p className="text-sm text-gray-500">File &gt; New Project 를 클릭하여 프로젝트를 생성해주세요.</p>
      </div>
    );
  }

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