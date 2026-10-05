import { AppEvent } from '@shared/ipc';

/** Shown while no project is open. The buttons do what the File menu items do. */
export default function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen">
      <div className="text-center max-w-md mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">아직 프로젝트를 생성하지 않았습니다.</h1>
        <p className="text-sm text-gray-500 mb-8">
          File &gt; New Project 를 클릭하여 프로젝트를 생성하거나
          <br />
          File &gt; Open Project 를 클릭하여 기존 프로젝트를 열어주세요.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            className="inline-flex h-9 items-center rounded-md bg-blue-500 px-4 text-sm text-white transition hover:bg-blue-600"
            onClick={() => window.dispatchEvent(new Event(AppEvent.createNewProject))}
          >
            새 프로젝트 생성
          </button>
          <button
            className="inline-flex h-9 items-center rounded-md bg-gray-500 px-4 text-sm text-white transition hover:bg-gray-600"
            onClick={() => window.dispatchEvent(new Event(AppEvent.openProject))}
          >
            기존 프로젝트 열기
          </button>
        </div>
      </div>
    </div>
  );
}
