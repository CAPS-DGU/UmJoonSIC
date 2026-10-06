import { FolderOpen, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppEvent, type RecentProject } from '@shared/ipc';
import { useProjectStore } from '@/features/project/projectStore';
import { useStrings } from '@/i18n';

/** Shown while no project is open: start a project, open one, or go back to a recent one. */
export default function WelcomeScreen() {
  const t = useStrings();
  const openProjectByPath = useProjectStore(s => s.openProjectByPath);
  const [recent, setRecent] = useState<RecentProject[]>([]);

  useEffect(() => {
    void window.api.getRecentProjects().then(res => {
      if (res.success && res.data) setRecent(res.data);
    });
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-auto bg-white px-4">
      <div className="flex w-full max-w-md flex-col gap-8 py-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.welcome.title}</h1>
          <p className="mt-1 text-sm text-gray-700">{t.welcome.subtitle}</p>
        </div>
        <div className="flex gap-3">
          {/* The same commands as File > New Project and File > Open Project. */}
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
            onClick={() => window.dispatchEvent(new Event(AppEvent.createNewProject))}
          >
            <Plus className="size-4" />
            {t.welcome.newProject}
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
            onClick={() => window.dispatchEvent(new Event(AppEvent.openProject))}
          >
            <FolderOpen className="size-4" />
            {t.welcome.openProject}
          </button>
        </div>
        {recent.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-800">{t.welcome.recent}</h2>
            <ul className="flex flex-col divide-y divide-gray-200 rounded-md border border-gray-300">
              {recent.map(project => (
                <li key={project.sicPath}>
                  <button
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-gray-50"
                    onClick={() => void openProjectByPath(project.sicPath)}
                    title={project.sicPath}
                  >
                    <span className="text-sm font-medium text-gray-900">{project.name}</span>
                    <span className="w-full truncate font-mono text-xs text-gray-600">
                      {project.sicPath.replace(/[\\/]project\.sic$/, '')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-xs text-gray-600">{t.welcome.shortcuts}</p>
      </div>
    </div>
  );
}
