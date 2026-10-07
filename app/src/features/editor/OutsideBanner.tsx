import { Info } from 'lucide-react';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import {
  copyIntoProject,
  createProjectFor,
  isOutsideFile,
  openFromOutside,
  useOutsideFiles,
} from '@/features/project/outsideFiles';
import { useProjectStore } from '@/features/project/projectStore';
import { useStrings } from '@/i18n';
import { folderOf } from '@/lib/projectPath';

const ACTION = 'font-medium text-blue-700 hover:underline';

/**
 * Over a file that is not part of the open project (or open without a project): it is edited
 * and saved in place but never assembled, and the ways to change that.
 */
export default function OutsideBanner() {
  const t = useStrings();
  const activePath = useEditorTabStore(s => s.activePath);
  const projectPath = useProjectStore(s => s.projectPath);
  const projects = useOutsideFiles(s => s.projects);
  if (!activePath || !isOutsideFile(activePath)) return null;
  const itsProject = projects[activePath] ?? null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-gray-800"
      data-outside-banner
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Info className="size-3.5 shrink-0 text-blue-700" aria-hidden />
        {projectPath ? t.outside.banner : t.outside.bannerNoProject}
      </span>
      {projectPath && (
        <button type="button" className={ACTION} onClick={() => void copyIntoProject(activePath)}>
          {t.outside.copyIntoProject}
        </button>
      )}
      {itsProject ? (
        <button
          type="button"
          className={ACTION}
          onClick={() =>
            void openFromOutside({ kind: 'file', path: activePath, project: itsProject })
          }
        >
          {t.outside.openItsProject(folderOf(itsProject).split(/[/\\]/).pop() ?? '')}
        </button>
      ) : (
        <button type="button" className={ACTION} onClick={() => void createProjectFor(activePath)}>
          {t.outside.createProject}
        </button>
      )}
    </div>
  );
}
