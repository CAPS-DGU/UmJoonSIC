import { useEffect, useMemo, useState } from 'react';
import { FilePlus, FolderOpen, FolderPlus, RefreshCw } from 'lucide-react';
import { AppEvent } from '@shared/ipc';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { ContextMenu } from '@/features/fileTree/ContextMenu';
import { FileTreeItem, ROOT_PATH } from '@/features/fileTree/FileTreeItem';
import {
  NameDialog,
  type NewFileChoice,
  type NewFileOptions,
} from '@/features/fileTree/NameDialog';
import { deviceHex } from '@/features/debugger/lib/deviceUse';
import { useMainFile, useProjectSources } from '@/features/devices/useProjectSources';
import { connectDevice } from '@/features/project/deviceSettings';
import type { FileStructure } from '@/features/fileTree/types';
import { useFileTree } from '@/features/fileTree/useFileTree';
import { useFileTreeNavigation } from '@/features/fileTree/useFileTreeNavigation';
import { useProjectStore } from '@/features/project/projectStore';
import { openProjectSettings, SETTINGS_TAB } from '@/features/project/projectSettingsTab';
import { FileActionError, useProjectFiles } from '@/features/project/useProjectFiles';
import { strings, useStrings } from '@/i18n';
import { BAR_ICON_BUTTON } from '@/lib/controls';
import { moveItem } from '@/lib/moveItem';
import { ask, showError } from '@/stores/dialogStore';
import { notify } from '@/stores/toastStore';

interface ContextMenuState {
  x: number;
  y: number;
  item: FileStructure;
}

type NameRequest =
  | { kind: 'file' | 'folder'; where: FileStructure | null }
  | { kind: 'rename'; item: FileStructure };

const ICON_SIZE = 16;

/** The message for a failed file action, in the interface language. */
function explain(error: unknown, name: string) {
  const t = strings();
  const code = error instanceof FileActionError ? error.code : undefined;
  if (code === 'exists') return t.messages.nameExists(name);
  if (code === 'badName') return t.messages.nameBad;
  if (code === 'emptyName') return t.messages.nameEmpty;
  return error instanceof Error ? error.message : String(error);
}

/** The folder a new entry goes into, for the dialog's hint ('' = the project root). */
const folderOf = (item: FileStructure | null) =>
  !item
    ? ''
    : item.type === 'folder'
      ? item.relativePath
      : item.relativePath.split('/').slice(0, -1).join('/');

/** Left column: project name, file actions and the file tree. */
export default function SideBar() {
  const t = useStrings();
  // The project node (ROOT_PATH) starts open.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [ROOT_PATH]: true });
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [treeFocused, setTreeFocused] = useState(false);

  const projectName = useProjectStore(s => s.projectName);
  const projectPath = useProjectStore(s => s.projectPath);
  const fileTree = useProjectStore(s => s.fileTree);
  const refreshFileTree = useProjectStore(s => s.refreshFileTree);
  const selectedFileOrFolder = useProjectStore(s => s.selectedFileOrFolder);
  const setSelectedFileOrFolder = useProjectStore(s => s.setSelectedFileOrFolder);
  const projectFiles = useProjectStore(s => s.settings.asm);
  const changeSettings = useProjectStore(s => s.changeSettings);
  // What the sources say: the devices the program uses, the main program's file.
  const sources = useProjectSources();
  const mainFile = useMainFile(sources);
  /** Move an assembled file one place earlier or later; add or remove it (written at once). */
  const moveAsm = (file: string, by: -1 | 1) => {
    const i = projectFiles.indexOf(file);
    if (i < 0 || i + by < 0 || i + by >= projectFiles.length) return;
    void changeSettings({ asm: moveItem(projectFiles, i, i + by) });
  };
  const toggleAsm = (file: string) => {
    const before = projectFiles;
    if (!before.includes(file)) {
      void changeSettings({ asm: [...before, file] });
      return;
    }
    void changeSettings({ asm: before.filter(f => f !== file) }).then(ok => {
      if (ok)
        notify('info', t.settings.removedAsm(file), {
          label: t.settings.undo,
          run: () => void changeSettings({ asm: before }),
        });
    });
  };
  const openTab = useEditorTabStore(s => s.openTab);
  const { createFile, createFolder, deleteFile, deleteFolder, renameEntry } = useProjectFiles();

  const fileTreeStructure = useFileTree(fileTree);
  // The tree under one node, the project: project.sic is not a file of it (the node itself
  // opens the settings that edit project.sic).
  const projectRoot = useMemo<FileStructure>(
    () => ({
      type: 'folder',
      name: projectName,
      relativePath: ROOT_PATH,
      children: fileTreeStructure.filter(item => item.relativePath !== SETTINGS_TAB),
    }),
    [projectName, fileTreeStructure],
  );

  // The project node does not fold (also not with the arrow keys).
  const toggleFolder = (relativePath: string) => {
    if (relativePath === ROOT_PATH) return;
    setExpanded(prev => ({ ...prev, [relativePath]: !prev[relativePath] }));
  };

  /** Open every folder on the way to `relativePath` (a new file is shown, not hidden). */
  const reveal = (relativePath: string) => {
    const parts = relativePath.split('/').slice(0, -1);
    setExpanded(prev => {
      const next: Record<string, boolean> = { ...prev, [ROOT_PATH]: true };
      parts.forEach((_, i) => (next[parts.slice(0, i + 1).join('/')] = true));
      return next;
    });
  };

  const handleOpenFile = (item: FileStructure) => {
    if (item.relativePath === ROOT_PATH) {
      void openProjectSettings();
    } else if (item.type === 'file') {
      openTab({ title: item.name, filePath: item.relativePath });
    }
  };

  // File > New File (Ctrl+N).
  useEffect(() => {
    const onNewFile = () =>
      setNameRequest({ kind: 'file', where: useProjectStore.getState().selectedFileOrFolder });
    window.addEventListener(AppEvent.newFile, onNewFile);
    return () => window.removeEventListener(AppEvent.newFile, onNewFile);
  }, []);

  const confirmDelete = async (item: FileStructure) => {
    const yes = await ask<boolean>({
      title: t.files.deleteTitle(item.name),
      message: item.type === 'folder' ? t.files.deleteFolder : t.files.deleteFile,
      tone: 'warning',
      buttons: [
        { label: t.common.cancel, value: false, variant: 'plain' },
        { label: t.common.delete, value: true, variant: 'danger' },
      ],
      cancelValue: false,
    });
    if (!yes) return;
    try {
      await (item.type === 'folder' ? deleteFolder(item) : deleteFile(item));
    } catch (error) {
      void showError(t.messages.deleteFailed, explain(error, item.name));
    }
  };

  const { focusPath, flatList, setFocusIndex, handleKeyDown } = useFileTreeNavigation(
    [projectRoot],
    expanded,
    toggleFolder,
    handleOpenFile,
  );
  // The keyboard position follows a click: two entries were marked (the first one as the
  // keyboard's, the clicked one as selected), and Enter opened the first.
  const selectedPath = selectedFileOrFolder?.relativePath;
  useEffect(() => {
    const index = flatList.findIndex(item => item.relativePath === selectedPath);
    if (index >= 0) setFocusIndex(index);
  }, [selectedPath, flatList, setFocusIndex]);

  // The New File dialog's options: the next place in the assembled files, and the devices the
  // program uses but are not connected (then the textbook's F1 and 05).
  const detectedDevices = sources.devices;
  const connectedDevices = useProjectStore(s => s.settings.filedevices);
  const newFileOptions: NewFileOptions = {
    assembleOrdinal: t.files.ordinal(projectFiles.length + 1),
    deviceSuggestions: [
      ...detectedDevices
        .filter(d => !connectedDevices.some(c => c.index === d.device))
        .map(d => deviceHex(d.device)),
      'F1',
      '05',
    ].filter((v, i, all) => all.indexOf(v) === i),
    deviceUses: Object.fromEntries(detectedDevices.map(d => [deviceHex(d.device), d.uses])),
  };

  const dialog = (() => {
    if (!nameRequest) return null;
    if (nameRequest.kind === 'rename') {
      const { item } = nameRequest;
      return {
        title: t.files.renameTitle(item.name),
        label: t.files.newName,
        initial: item.name,
        submitLabel: t.common.rename,
        onSubmit: async (name: string) => {
          try {
            await renameEntry(item, name);
            return null;
          } catch (error) {
            return explain(error, name);
          }
        },
      };
    }
    const folder = folderOf(nameRequest.where);
    const where = nameRequest.where;
    return nameRequest.kind === 'file'
      ? {
          title: t.files.newFileTitle,
          hint: folder ? t.files.inFolder(folder) : undefined,
          label: t.files.fileName,
          extensions: ['.asm', '.txt'],
          submitLabel: t.common.create,
          fileOptions: newFileOptions,
          onSubmit: async (name: string, ext: string, choice: NewFileChoice) => {
            // A name typed with its extension keeps it.
            const [base, extension] = /\.(asm|txt)$/i.test(name)
              ? [name.replace(/\.(asm|txt)$/i, ''), name.slice(-4).toLowerCase()]
              : [name, ext];
            try {
              // The dialog's checkboxes say whether it is assembled or connected.
              const file = await createFile(where, base, extension, choice.assemble);
              if (file) {
                reveal(file.relativePath);
                setSelectedFileOrFolder(file);
                void openTab({ title: file.name, filePath: file.relativePath });
                if (choice.device !== null) await connectDevice(choice.device, file.relativePath);
              }
              return null;
            } catch (error) {
              return explain(error, `${base}${extension}`);
            }
          },
        }
      : {
          title: t.files.newFolderTitle,
          hint: folder ? t.files.inFolder(folder) : undefined,
          label: t.files.folderName,
          submitLabel: t.common.create,
          onSubmit: async (name: string) => {
            try {
              await createFolder(where, name);
              reveal(`${folder ? folder + '/' : ''}${name}/x`);
              return null;
            } catch (error) {
              return explain(error, name);
            }
          },
        };
  })();

  return (
    <div className="w-full bg-white border-r border-gray-300 flex flex-col h-full">
      {/* The pane's title and its actions; the project itself is the tree's first node (the top
          bar showed the project's name and the tree listed project.sic as a file). */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-gray-300 px-2">
        <span className="min-w-0 truncate text-xs font-semibold tracking-wide text-gray-700 uppercase">
          {t.files.project}
        </span>
        <div className="flex shrink-0 gap-0.5">
          <button
            className={BAR_ICON_BUTTON}
            onClick={() => setNameRequest({ kind: 'file', where: selectedFileOrFolder })}
            title={t.files.newFile}
            aria-label={t.files.newFile}
          >
            <FilePlus width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          <button
            className={BAR_ICON_BUTTON}
            onClick={() => setNameRequest({ kind: 'folder', where: selectedFileOrFolder })}
            title={t.files.newFolder}
            aria-label={t.files.newFolder}
          >
            <FolderPlus width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          <button
            className={BAR_ICON_BUTTON}
            onClick={refreshFileTree}
            title={t.files.refresh}
            aria-label={t.files.refresh}
          >
            <RefreshCw width={ICON_SIZE} height={ICON_SIZE} />
          </button>
          <button
            className={BAR_ICON_BUTTON}
            onClick={() => window.dispatchEvent(new Event(AppEvent.openProject))}
            title={t.files.openProject}
            aria-label={t.files.openProject}
          >
            <FolderOpen width={ICON_SIZE} height={ICON_SIZE} />
          </button>
        </div>
      </div>

      <div
        className="slim-scroll flex-1 overflow-y-auto overflow-x-hidden"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => setTreeFocused(true)}
        onBlur={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setTreeFocused(false);
        }}
      >
        {[projectRoot].map(item => (
          <FileTreeItem
            key={item.relativePath}
            item={item}
            projectPath={projectPath}
            mainFile={mainFile}
            expanded={expanded}
            toggleFolder={toggleFolder}
            selected={selectedFileOrFolder}
            onSelect={setSelectedFileOrFolder}
            onOpenFile={handleOpenFile}
            onContextMenu={(e, item) => {
              e.preventDefault();
              setSelectedFileOrFolder(item);
              setContextMenu({ x: e.clientX, y: e.clientY, item });
            }}
            projectFiles={projectFiles}
            focusPath={focusPath}
            showFocus={treeFocused}
          />
        ))}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onNewFile={() => setNameRequest({ kind: 'file', where: contextMenu.item })}
          onNewFolder={() => setNameRequest({ kind: 'folder', where: contextMenu.item })}
          onRename={() => setNameRequest({ kind: 'rename', item: contextMenu.item })}
          onOpenSettings={() => void openProjectSettings()}
          onOpenProject={() => window.dispatchEvent(new Event(AppEvent.openProject))}
          asm={
            /\.asm$/i.test(contextMenu.item.relativePath) && contextMenu.item.type === 'file'
              ? {
                  listed: projectFiles.includes(contextMenu.item.relativePath),
                  first: projectFiles[0] === contextMenu.item.relativePath,
                  last: projectFiles.at(-1) === contextMenu.item.relativePath,
                }
              : null
          }
          onAsmEarlier={() => moveAsm(contextMenu.item.relativePath, -1)}
          onAsmLater={() => moveAsm(contextMenu.item.relativePath, 1)}
          onAsmToggle={() => toggleAsm(contextMenu.item.relativePath)}
          onReveal={() =>
            void window.api.showInFolder(`${projectPath}/${contextMenu.item.relativePath}`)
          }
          onDelete={() => void confirmDelete(contextMenu.item)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {dialog && (
        <NameDialog
          open
          title={dialog.title}
          hint={'hint' in dialog ? dialog.hint : undefined}
          label={dialog.label}
          initial={'initial' in dialog ? dialog.initial : ''}
          submitLabel={dialog.submitLabel}
          extensions={'extensions' in dialog ? dialog.extensions : undefined}
          fileOptions={'fileOptions' in dialog ? dialog.fileOptions : undefined}
          onClose={() => setNameRequest(null)}
          onSubmit={dialog.onSubmit}
        />
      )}
    </div>
  );
}
