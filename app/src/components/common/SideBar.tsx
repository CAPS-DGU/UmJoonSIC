import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '@/stores/ProjectStore';
import {
  FolderPlus,
  RefreshCcw,
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FilePlus,
  Settings,
  List,
  Trash2,
} from 'lucide-react';
import { useEditorTabStore } from '@/stores/EditorTabStore';

type FileItem = {
  type: 'file';
  name: string;
  relativePath: string;
};

type FolderItem = {
  type: 'folder';
  name: string;
  children: FileStructure[];
  relativePath: string;
};

type FileStructure = FileItem | FolderItem;

// ADDED: 'any' 대신 사용할 중간 트리 구조에 대한 명시적 타입 선언
type IntermediateFileNode = {
  __type: 'file';
};

type IntermediateFolderNode = {
  __type: 'folder';
  __children: Record<string, IntermediateNode>;
};

type IntermediateNode = IntermediateFileNode | IntermediateFolderNode;

function convertToFileStructure(fileTree: string[]): FileStructure[] {
  // CHANGED: 'any' 대신 IntermediateNode 타입을 사용
  const root: Record<string, IntermediateNode> = {};

  fileTree.forEach(path => {
    const isFolder = path.endsWith('/');
    const parts = path.split('/').filter(Boolean);

    let current: Record<string, IntermediateNode> = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        if (isFolder) {
          if (!current[part]) {
            current[part] = { __type: 'folder', __children: {} };
          }
        } else {
          if (!current[part]) {
            current[part] = { __type: 'file' };
          }
        }
      } else {
        if (!current[part]) {
          current[part] = { __type: 'folder', __children: {} };
        }
        // CHANGED: 타입 단언을 통해 타입 안정성 확보
        current = (current[part] as IntermediateFolderNode).__children;
      }
    }
  });

  // CHANGED: 'any' 대신 IntermediateNode 타입을 사용
  function toFileStructure(
    obj: Record<string, IntermediateNode>,
    parentPath = '',
  ): FileStructure[] {
    return (
      Object.entries(obj)
        .map(([name, value]): FileStructure => {
          const currentPath = parentPath ? `${parentPath}/${name}` : name;
          if (value.__type === 'folder') {
            return {
              type: 'folder',
              name,
              // 재귀 호출
              children: toFileStructure(value.__children, currentPath),
              relativePath: currentPath,
            };
          } else {
            return {
              type: 'file',
              name,
              relativePath: currentPath,
            };
          }
        })
        // ADDED: 정렬 로직 추가
        .sort((a, b) => {
          // 폴더가 파일보다 먼저 오도록 정렬
          if (a.type === 'folder' && b.type === 'file') return -1;
          if (a.type === 'file' && b.type === 'folder') return 1;
          // 같은 타입끼리는 이름순으로 정렬
          return a.name.localeCompare(b.name);
        })
    );
  }

  return toFileStructure(root);
}

export default function SideBar() {
  console.log('SideBar rendered');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    item: FileStructure | null;
  }>({ show: false, x: 0, y: 0, item: null });
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    projectName,
    projectPath,
    fileTree,
    settings,
    refreshFileTree,
    selectedFileOrFolder,
    setSelectedFileOrFolder,
    getFolderFromSelectedFileOrFolder,
    addAsmFile,
    setSettings,
  } = useProjectStore();
  const { tabs, addTab, closeTab } = useEditorTabStore();

  const dummyFileTree = [...fileTree];

  const fileTreeStructure: FileStructure[] = convertToFileStructure(dummyFileTree);

  const toggleFolder = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const startCreatingFile = () => {
    setIsCreatingFile(true);
    setNewFileName('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      setIsCreatingFile(false);
      return;
    }

    const folderPath = `${projectPath}/${getFolderFromSelectedFileOrFolder()}`.replace(/\/+/g, '/');
    const result = await window.api.createNewFile(folderPath, newFileName.trim());

    addAsmFile(getFolderFromSelectedFileOrFolder() + newFileName.trim());
    if (result.success) {
      refreshFileTree();
      setIsCreatingFile(false);
      setNewFileName('');
    } else {
      alert(`파일 생성 실패: ${result.message}`);
    }
  };

  const startCreatingFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setIsCreatingFolder(false);
      return;
    }

    const folderPath = `${projectPath}/${getFolderFromSelectedFileOrFolder()}`.replace(/\/+/g, '/');
    const result = await window.api.createNewFolder(folderPath, newFolderName.trim());

    if (result.success) {
      refreshFileTree();
      setIsCreatingFolder(false);
      setNewFolderName('');
    } else {
      alert(`폴더 생성 실패: ${result.message}`);
    }
  };

  const handleKeyDownFile = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateFile();
    } else if (e.key === 'Escape') {
      setIsCreatingFile(false);
      setNewFileName('');
    }
  };

  const handleKeyDownFolder = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateFolder();
    } else if (e.key === 'Escape') {
      setIsCreatingFolder(false);
      setNewFolderName('');
    }
  };

  useEffect(() => {
    if (isCreatingFile && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingFile]);

  const confirmDelete = (item: FileStructure): boolean => {
    const itemName = item.name;
    const itemType = item.type === 'file' ? '파일' : '폴더';

    if (item.type === 'folder') {
      return confirm(
        `"${itemName}" 폴더와 그 안의 모든 내용을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
      );
    } else {
      return confirm(
        `"${itemName}" ${itemType}을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
      );
    }
  };

  const handleDelete = async (item: FileStructure) => {
    if (!confirmDelete(item)) {
      return;
    }

    try {
      let result;
      if (item.type === 'file') {
        result = await window.api.deleteFile(projectPath, item.relativePath);
        const tabToRemove = tabs.find(tab => tab.filePath === item.relativePath);
        setSettings({
          asm: settings.asm.filter(
            asm => asm !== item.relativePath && asm !== '/' + item.relativePath,
          ),
          main: settings.main,
        });
        if (tabToRemove) {
          closeTab(tabToRemove.idx);
        }
      } else {
        result = await window.api.deleteFolder(projectPath, item.relativePath);
        const tabsToRemove = tabs.filter(tab => tab.filePath.startsWith(item.relativePath));
        tabsToRemove.forEach(tab => closeTab(tab.idx));
        setSettings({
          asm: settings.asm.filter(asm => !asm.endsWith(item.relativePath)),
          main: settings.main,
        });
      }

      if (result.success) {
        refreshFileTree();
        if (
          selectedFileOrFolder === item.relativePath ||
          (item.type === 'folder' && selectedFileOrFolder === item.relativePath + '/')
        ) {
          setSelectedFileOrFolder('');
        }
      } else {
        alert(`삭제 실패: ${result.message}`);
      }
    } catch (error) {
      alert(`삭제 중 오류가 발생했습니다: ${error}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' && selectedFileOrFolder) {
      e.preventDefault();

      const findItem = (items: FileStructure[]): FileStructure | null => {
        for (const item of items) {
          if (item.type === 'folder') {
            if (item.relativePath + '/' === selectedFileOrFolder) {
              return item;
            }
            const found = findItem(item.children);
            if (found) return found;
          } else {
            if (item.relativePath === selectedFileOrFolder) {
              return item;
            }
          }
        }
        return null;
      };

      const itemToDelete = findItem(fileTreeStructure);
      if (itemToDelete) {
        handleDelete(itemToDelete);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileStructure) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      item,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, item: null });
  };

  useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const renderItems = (items: FileStructure[]): React.ReactNode => {
    return items.map((item, index) => {
      if (item.type === 'folder') {
        const isOpen = expanded[item.name];
        return (
          <div key={index}>
            <div
              className={`flex items-center gap-2 cursor-pointer px-2 py-1 hover:bg-gray-200 ${
                selectedFileOrFolder === item.relativePath + '/' ? 'bg-gray-100' : ''
              }`}
              // CHANGED: onClick 핸들러에 toggleFolder 추가, onDoubleClick 제거
              onClick={() => {
                setSelectedFileOrFolder(item.relativePath + '/');
                toggleFolder(item.name); // 단일 클릭으로 폴더 열기/닫기
              }}
              onContextMenu={e => handleContextMenu(e, item)}
            >
              <span className="text-xs w-3">
                {isOpen ? (
                  <ChevronDown width={16} height={16} />
                ) : (
                  <ChevronRight width={16} height={16} />
                )}
              </span>
              <Folder width={16} height={16} />
              <span>{item.name}</span>
            </div>
            {isOpen && <div className="ml-6">{renderItems(item.children)}</div>}
          </div>
        );
      }

      const getFileIcon = (fileName: string) => {
        if (fileName.toLowerCase() === 'project.sic') {
          return <Settings width={16} height={16} />;
        }
        if (fileName.toLowerCase().endsWith('.lst')) {
          return <List width={16} height={16} />;
        }
        return <File width={16} height={16} />;
      };

      return (
        <div
          key={index}
          className={`flex items-center gap-2 px-2 py-1 hover:bg-gray-100 ${
            selectedFileOrFolder === item.relativePath ? 'bg-gray-100' : ''
          }`}
          onClick={() => {
            setSelectedFileOrFolder(item.relativePath);
          }}
          onDoubleClick={() => {
            addTab({
              idx: tabs.length,
              title: item.name,
              filePath: item.relativePath,
              isModified: false,
              fileContent: '',
              isActive: true,
              cursor: {
                line: 0,
                column: 0,
              },
              breakpoints: [],
            });
          }}
          onContextMenu={e => handleContextMenu(e, item)}
        >
          {getFileIcon(item.name)}
          <span>{item.name}</span>
        </div>
      );
    });
  };

  return (
    <div
      className="w-60 bg-white border-r border-gray-300 flex flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex items-center justify-between p-2 border-b border-gray-300">
        <span className="font-bold">{projectName}</span>
        <div className="flex gap-2">
          <button
            className="p-1 rounded hover:bg-gray-200"
            onClick={() => {
              startCreatingFile();
            }}
          >
            <FilePlus width={16} height={16} />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-200"
            onClick={() => {
              console.log(fileTree);
              startCreatingFolder();
            }}
          >
            <FolderPlus width={16} height={16} />
          </button>
          <button className="p-1 rounded hover:bg-gray-200" onClick={() => refreshFileTree()}>
            <RefreshCcw width={16} height={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {renderItems(fileTreeStructure)}
        {isCreatingFile && (
          <div className="px-2 py-1">
            <input
              ref={inputRef}
              type="text"
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={handleKeyDownFile}
              onBlur={() => {
                if (!newFileName.trim()) {
                  setIsCreatingFile(false);
                }
              }}
              placeholder="파일명을 입력하세요...(.asm)"
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
        )}
        {isCreatingFolder && (
          <div className="px-2 py-1">
            <input
              ref={inputRef}
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={handleKeyDownFolder}
              onBlur={() => {
                if (!newFolderName.trim()) {
                  setIsCreatingFolder(false);
                }
              }}
              placeholder="폴더명을 입력하세요..."
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
        )}
      </div>

      {contextMenu.show && contextMenu.item && (
        <div
          className="fixed bg-white border border-gray-300 rounded shadow-lg z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            className="flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-gray-100 text-red-600"
            onClick={() => {
              handleDelete(contextMenu.item!);
              closeContextMenu();
            }}
          >
            <Trash2 width={16} height={16} />
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
