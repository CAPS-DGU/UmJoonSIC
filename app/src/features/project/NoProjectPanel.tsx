import { FileCode, FilePlus2, FolderOpen, X } from 'lucide-react';
import { useEffect } from 'react';
import { AppEvent } from '@shared/ipc';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { createProjectFor, explainRunNeedsProject } from '@/features/project/outsideFiles';
import { useProjectStore } from '@/features/project/projectStore';
import { useStrings } from '@/i18n';
import { FORM_BUTTON } from '@/lib/controls';
import { folderOf } from '@/lib/projectPath';

/**
 * The file column when files are open without a project (an assembly file opened from outside
 * the app with no project.sic near it): what that means, and the ways to a project. Nothing
 * is written until the user asks for it.
 */
export default function NoProjectPanel() {
  const t = useStrings();
  const tabs = useEditorTabStore(s => s.tabs);
  const activePath = useEditorTabStore(s => s.activePath);
  const openProject = useProjectStore(s => s.openProject);
  const closeProject = useProjectStore(s => s.closeProject);
  const file = activePath ?? tabs[0]?.filePath ?? null;
  const folder = file ? folderOf(file) : '';

  // The run panel (which takes Run and Step from the menu and the keys) is not shown without a
  // project: here they explain that running needs one.
  useEffect(() => {
    const explain = () => void explainRunNeedsProject();
    const events = [AppEvent.runStart, AppEvent.runStep];
    events.forEach(e => window.addEventListener(e, explain));
    return () => events.forEach(e => window.removeEventListener(e, explain));
  }, []);

  return (
    <div className="flex h-full flex-col bg-gray-50 text-sm" data-no-project>
      <div className="flex h-10 shrink-0 items-center border-b border-gray-300 px-2">
        <span className="min-w-0 truncate text-xs font-semibold tracking-wide text-gray-700 uppercase">
          {t.outside.noProjectTitle}
        </span>
      </div>
      <div className="slim-scroll flex flex-1 flex-col gap-3 overflow-auto p-3">
        <p className="text-gray-700">{t.outside.noProjectText}</p>
        <ul className="flex flex-col gap-1">
          {tabs.map(tab => (
            <li
              key={tab.filePath}
              className="flex min-w-0 items-center gap-1.5 text-gray-800"
              title={tab.filePath}
            >
              <FileCode className="size-4 shrink-0 text-gray-600" aria-hidden />
              <span className="truncate">{tab.title}</span>
            </li>
          ))}
        </ul>
        {file && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 font-medium text-white hover:bg-blue-700"
              onClick={() => void createProjectFor(file)}
              data-create-project
            >
              <FilePlus2 className="size-4" aria-hidden />
              {t.outside.createProject}
            </button>
            <p className="text-xs text-gray-600 [overflow-wrap:anywhere]">
              {t.outside.createProjectHint(folder)}
            </p>
          </div>
        )}
        <button
          type="button"
          className={`${FORM_BUTTON} gap-1.5`}
          onClick={() => void openProject()}
        >
          <FolderOpen className="size-4" aria-hidden />
          {t.outside.openProject}
        </button>
        <button
          type="button"
          className={`${FORM_BUTTON} gap-1.5`}
          onClick={() => void closeProject()}
        >
          <X className="size-4" aria-hidden />
          {t.outside.closeFiles}
        </button>
      </div>
    </div>
  );
}
