// Files opened from outside the app (double-click, "Open with", the command line, a second
// start): a project.sic opens its project; an assembly file opens as follows.
//
//   No project open, a project.sic near the file  →  that project, with the file in a tab.
//   No project open, none near it                 →  the file alone, edit only (nothing written).
//   A project open and the file in it             →  its tab.
//   A project open, the file in another project   →  ask: open that project / edit the file only.
//   A project open, the file in no project        →  a tab outside the project: edited, saved,
//                                                    never assembled.
//
// Like VS Code, JetBrains and Visual Studio, an open project is never closed without asking,
// and a file that is not part of it is edited in place ("Miscellaneous Files"). A file outside
// the project has an absolute path as its tab path. "Near" is decided in the main process
// (electron/project/nearbyProject.ts).
import { create } from 'zustand';
import type { OpenRequest } from '@shared/ipc';
import { useRunningStore } from '@/features/debugger/runningStore';
import { machineModeOf, sectionsInSource } from '@/features/devices/sourceDevices';
import { tabKind, useEditorTabStore } from '@/features/editor/editorTabStore';
import { resolveUnsavedChanges } from '@/features/editor/unsavedChanges';
import { useProjectStore } from '@/features/project/projectStore';
import { strings } from '@/i18n';
import { folderOf, isAbsolutePath, toProjectRelativePath } from '@/lib/projectPath';
import { ask, showError } from '@/stores/dialogStore';
import { notify } from '@/stores/toastStore';

interface OutsideFilesState {
  /** Files open from outside the project (absolute paths), each with the project.sic near it. */
  projects: Record<string, string | null>;
}

export const useOutsideFiles = create<OutsideFilesState>(() => ({ projects: {} }));

// A closed tab (or all of them, with the project) is forgotten here too.
useEditorTabStore.subscribe(({ tabs }) => {
  const { projects } = useOutsideFiles.getState();
  const open = Object.keys(projects).filter(file => tabs.some(tab => tab.filePath === file));
  if (open.length !== Object.keys(projects).length) {
    useOutsideFiles.setState({ projects: Object.fromEntries(open.map(f => [f, projects[f]])) });
  }
});

/**
 * Is this tab a file from outside the project (or open without a project)? Its path is
 * absolute; a run's List tabs have absolute paths too, but they are listings.
 */
export const isOutsideFile = (filePath: string) =>
  isAbsolutePath(filePath) && tabKind(filePath) === 'source';

const baseName = (filePath: string) => filePath.split(/[/\\]/).pop() ?? filePath;
const sep = (folder: string) => (folder.includes('\\') && !folder.includes('/') ? '\\' : '/');
const joinPath = (folder: string, name: string) =>
  folder.replace(/[/\\]+$/, '') + sep(folder) + name;

/** The file is inside the open project's folder. */
const inProject = (projectPath: string, file: string) =>
  !!projectPath && toProjectRelativePath(projectPath, file) !== file;

/** Open a file from outside the project in a tab: edit and save only. */
export async function openOutsideFile(file: string, project: string | null) {
  useOutsideFiles.setState(s => ({ projects: { ...s.projects, [file]: project } }));
  await useEditorTabStore.getState().openTab({ title: baseName(file), filePath: file });
}

/** Open a project file in a tab; say so if it is an assembly file the project does not assemble. */
async function openProjectFile(relative: string, { notice = true } = {}) {
  await useEditorTabStore.getState().openTab({ title: baseName(relative), filePath: relative });
  const { settings } = useProjectStore.getState();
  if (notice && /\.asm$/i.test(relative) && !settings.asm.includes(relative)) {
    offerToAssemble(relative, strings().outside.notAssembled(baseName(relative)));
  }
}

function offerToAssemble(relative: string, message: string) {
  notify('info', message, {
    label: strings().files.addToAsm,
    run: () => {
      const { settings, changeSettings } = useProjectStore.getState();
      if (!settings.asm.includes(relative))
        void changeSettings({ asm: [...settings.asm, relative] });
    },
  });
}

/** Handle something to open that came from outside the app (see the table above). */
export async function openFromOutside(request: OpenRequest) {
  const store = useProjectStore.getState();
  if (request.kind === 'project') {
    await store.openProjectByPath(request.path);
    return;
  }
  const file = request.path;
  const { projectPath, projectName } = store;
  if (inProject(projectPath, file)) {
    await openProjectFile(toProjectRelativePath(projectPath, file));
    return;
  }
  if (!request.project) {
    await openOutsideFile(file, null);
    return;
  }
  if (projectPath) {
    // Another project: never closed without asking.
    const t = strings();
    const other = baseName(folderOf(request.project));
    const running = useRunningStore.getState().isRunning;
    const answer = await ask<'open' | 'edit' | 'cancel'>({
      title: t.outside.otherProjectTitle(baseName(file)),
      message:
        t.outside.otherProject(baseName(file), other, projectName) +
        (running ? ` ${t.outside.runWillStop}` : ''),
      detail: folderOf(request.project),
      buttons: [
        { label: t.common.cancel, value: 'cancel' },
        { label: t.outside.editOnly, value: 'edit' },
        { label: t.outside.openOther(other), value: 'open', variant: 'primary' },
      ],
      cancelValue: 'cancel',
    });
    if (answer === 'edit') await openOutsideFile(file, request.project);
    if (answer !== 'open') return;
  }
  await store.openProjectByPath(request.project);
  const opened = useProjectStore.getState().projectPath;
  if (inProject(opened, file)) await openProjectFile(toProjectRelativePath(opened, file));
}

/** A file's text as the editor has it (unsaved edits too), else as it is on disk. */
async function textOf(file: string) {
  const tab = useEditorTabStore.getState().tabs.find(t => t.filePath === file);
  if (tab) return tab.content;
  const res = await window.api.readFile(file);
  return res.success ? (res.data ?? '') : '';
}

/**
 * Make a project for a file that has none: project.sic in the file's folder, with the file as
 * its program (its START name as the main section, the machine its instructions need), then
 * open it. The file is not moved. An open project is closed only after the user agrees.
 */
export async function createProjectFor(file: string) {
  const t = strings();
  const folder = folderOf(file);
  const { projectPath, projectName } = useProjectStore.getState();
  if (projectPath) {
    const running = useRunningStore.getState().isRunning;
    const ok = await ask<boolean>({
      title: t.outside.createConfirmTitle,
      message:
        t.outside.createConfirm(folder, projectName) + (running ? ` ${t.outside.runWillStop}` : ''),
      buttons: [
        { label: t.common.cancel, value: false },
        { label: t.outside.createProject, value: true, variant: 'primary' },
      ],
      cancelValue: false,
    });
    if (!ok) return;
  }
  // Unsaved edits first: nothing is written if the user cancels.
  if (!(await resolveUnsavedChanges())) return;
  const sicPath = joinPath(folder, 'project.sic');
  const exists = await window.api.pathExists([sicPath]);
  if (!(exists.success && exists.data?.[0])) {
    const text = await textOf(file);
    const settings = {
      asm: [baseName(file)],
      main: sectionsInSource(text)[0] ?? '',
      filedevices: [],
      mode: machineModeOf(text),
    };
    const res = await window.api.saveFile(sicPath, `${JSON.stringify(settings, null, 2)}\n`);
    if (!res.success) {
      void showError(t.outside.createFailed, res.message);
      return;
    }
  }
  await useProjectStore.getState().openProjectByPath(sicPath, { unsavedResolved: true });
  const opened = useProjectStore.getState().projectPath;
  if (inProject(opened, file)) {
    await openProjectFile(toProjectRelativePath(opened, file));
    notify('success', t.outside.created(folder));
  }
}

/**
 * Copy a file from outside into the open project (its folder), with the editor's text, and
 * open the copy in place of the outside tab. The original stays as it is.
 */
export async function copyIntoProject(file: string) {
  const t = strings();
  const { projectPath, fileTree, refreshFileTree } = useProjectStore.getState();
  if (!projectPath) return;
  const taken = new Set(fileTree.map(f => f.relativePath.toLowerCase()));
  const name = baseName(file);
  const dot = name.lastIndexOf('.');
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  let copy = name;
  for (let i = 2; taken.has(copy.toLowerCase()); i++) copy = `${stem}-${i}${ext}`;
  const text = await textOf(file);
  const created = await window.api.createNewFile(projectPath, copy);
  const saved = created.success
    ? await window.api.saveFile(joinPath(projectPath, copy), text)
    : created;
  if (!saved.success) {
    void showError(t.messages.createFailed, saved.message);
    return;
  }
  refreshFileTree();
  // The copy has the editor's text: the outside tab closes without asking.
  useEditorTabStore.getState().closeTab(file);
  await openProjectFile(copy, { notice: false });
  if (/\.asm$/i.test(copy)) offerToAssemble(copy, t.outside.copied(copy));
  else notify('success', t.outside.copied(copy));
}

/** Run, Step … with no project open: running needs one; offer to make it. */
export async function explainRunNeedsProject() {
  const t = strings();
  const { tabs, activePath } = useEditorTabStore.getState();
  const file =
    (activePath && isOutsideFile(activePath) && /\.asm$/i.test(activePath) && activePath) ||
    tabs.find(tab => isOutsideFile(tab.filePath) && /\.asm$/i.test(tab.filePath))?.filePath;
  if (!file) return;
  const create = await ask<boolean>({
    title: t.outside.runNeedsProjectTitle,
    message: t.outside.runNeedsProject,
    detail: t.outside.createProjectHint(folderOf(file)),
    buttons: [
      { label: t.common.cancel, value: false },
      { label: t.outside.createProject, value: true, variant: 'primary' },
    ],
    cancelValue: false,
  });
  if (create) await createProjectFor(file);
}
