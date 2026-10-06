import { useEffect, useState } from 'react';
import { FilePlus, FolderOpen, FolderPlus, RefreshCw } from 'lucide-react';
import { AppEvent } from '@shared/ipc';
import { useEditorTabStore } from '@/features/editor/editorTabStore';
import { ContextMenu } from '@/features/fileTree/ContextMenu';
import { FileTreeItem } from '@/features/fileTree/FileTreeItem';
import { NameDialog } from '@/features/fileTree/NameDialog';
import type { FileStructure } from '@/features/fileTree/types';
import { useFileTree } from '@/features/fileTree/useFileTree';
import { useFileTreeNavigation } from '@/features/fileTree/useFileTreeNavigation';
import { useProjectStore } from '@/features/project/projectStore';
import { FileActionError, useProjectFiles } from '@/features/project/useProjectFiles';
import { strings, useStrings } from '@/i18n';
import { BAR_ICON_BUTTON } from '@/lib/controls';
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
  const openTab = useEditorTabStore(s => s.openTab);
  const { createFile, createFolder, deleteFile, deleteFolder, renameEntry } = useProjectFiles();

  const fileTreeStructure = useFileTree(fileTree);

  const toggleFolder = (relativePath: string) =>
    setExpanded(prev => ({ ...prev, [relativePath]: !prev[relativePath] }));

  /** Open every folder on the way to `relativePath` (a new file is shown, not hidden). */
  const reveal = (relativePath: string) => {
    const parts = relativePath.split('/').slice(0, -1);
    setExpanded(prev => {
      const next = { ...prev };
      parts.forEach((_, i) => (next[parts.slice(0, i + 1).join('/')] = true));
      return next;
    });
  };

  const handleOpenFile = (item: FileStructure) => {
    if (item.type === 'file') {
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
    fileTreeStructure,
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
          onSubmit: async (name: string, ext: string) => {
            // A name typed with its extension keeps it.
            const [base, extension] = /\.(asm|txt)$/i.test(name)
              ? [name.replace(/\.(asm|txt)$/i, ''), name.slice(-4).toLowerCase()]
              : [name, ext];
            try {
              const file = await createFile(where, base, extension);
              if (file) {
                reveal(file.relativePath);
                setSelectedFileOrFolder(file);
                void openTab({ title: file.name, filePath: file.relativePath });
                // Added to project.sic's asm list (useProjectFiles): say so, with the way back.
                if (extension === '.asm') {
                  notify('info', t.files.addedToAsm(file.name), {
                    label: t.messages.openSettings,
                    run: () => void openTab({ title: 'project.sic', filePath: 'project.sic' }),
                  });
                }
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
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-gray-300 px-2">
        <span className="min-w-0 truncate text-sm font-semibold" title={projectPath}>
          {projectName}
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
        {fileTreeStructure.map(item => (
          <FileTreeItem
            key={item.relativePath}
            item={item}
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
          onClose={() => setNameRequest(null)}
          onSubmit={dialog.onSubmit}
        />
      )}
    </div>
  );
}
