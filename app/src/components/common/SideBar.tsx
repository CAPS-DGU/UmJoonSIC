import { useState } from 'react';
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
  List, // Import the List icon for .lst files
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

function convertToFileStructure(fileTree: string[]): FileStructure[] {
  const root: Record<string, any> = {};

  fileTree.forEach(path => {
    const isFolder = path.endsWith('/');
    const parts = path.split('/').filter(Boolean);

    let current = root;
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
        current = current[part].__children;
      }
    }
  });

  function toFileStructure(obj: Record<string, any>, parentPath = ''): FileStructure[] {
    return Object.entries(obj).map(([name, value]) => {
      const currentPath = parentPath ? `${parentPath}/${name}` : name;
      if (value.__type === 'folder') {
        return {
          type: 'folder',
          name,
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
    });
  }

  return toFileStructure(root);
}

export default function SideBar() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { projectName, fileTree, refreshFileTree } = useProjectStore();
  const { tabs, addTab } = useEditorTabStore();

  // Add the new file to the dummy data
  const dummyFileTree = [
    ...fileTree
  ];

  const fileTreeStructure: FileStructure[] = convertToFileStructure(dummyFileTree);

  const toggleFolder = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const renderItems = (items: FileStructure[]): React.ReactNode => {
    return items.map((item, index) => {
      if (item.type === 'folder') {
        const isOpen = expanded[item.name];
        return (
          <div key={index}>
            <div
              className="flex items-center gap-2 cursor-pointer px-2 py-1 hover:bg-gray-200"
              onClick={() => toggleFolder(item.name)}
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
        // Check for .lst extension and return the new icon
        if (fileName.toLowerCase().endsWith('.lst')) {
          return <List width={16} height={16} />;
        }
        return <File width={16} height={16} />;
      };

      return (
        <div
          key={index}
          className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100"
          onClick={() => {
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
            });
          }}
        >
          {getFileIcon(item.name)}
          <span>{item.name}</span>
        </div>
      );
    });
  };

  return (
    <div className="w-60 bg-white border-r border-gray-300 flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-gray-300">
        <span className="font-bold">{projectName}</span>
        <div className="flex gap-2">
          <button className="p-1 rounded hover:bg-gray-200">
            <FilePlus width={16} height={16} />
          </button>
          <button className="p-1 rounded hover:bg-gray-200">
            <FolderPlus width={16} height={16} />
          </button>
          <button className="p-1 rounded hover:bg-gray-200" onClick={() => refreshFileTree()}>
            <RefreshCcw width={16} height={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">{renderItems(fileTreeStructure)}</div>
    </div>
  );
}
