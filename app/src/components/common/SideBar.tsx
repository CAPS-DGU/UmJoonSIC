import { useState } from "react";
import { useProjectStore } from "@/stores/ProjectStore";

type FileItem = {
  type: "file";
  name: string;
};

type FolderItem = {
  type: "folder";
  name: string;
  children: FileStructure[];
};

type FileStructure = FileItem | FolderItem;

const fileStructure: FileStructure[] = [
  {
    type: "folder",
    name: "src",
    children: [
      { type: "file", name: "file.c" },
      { type: "file", name: "file.cpp" },
      { type: "file", name: "file.asm" },
    ],
  },
  {
    type: "folder",
    name: "path",
    children: [],
  },
];

function convertToFileStructure(fileTree: string[]): FileStructure[] {
  // 파일/폴더를 트리 구조로 변환
  const root: Record<string, any> = {};

  fileTree.forEach((path) => {
    // 폴더 경로 끝에 "/"가 붙어있으면 폴더로 간주
    const isFolder = path.endsWith("/");
    // 마지막 "/" 기준으로 분리
    const parts = path.split("/").filter(Boolean);

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        if (isFolder) {
          // 폴더
          if (!current[part]) {
            current[part] = { __type: "folder", __children: {} };
          }
        } else {
          // 파일
          if (!current[part]) {
            current[part] = { __type: "file" };
          }
        }
      } else {
        // 중간 폴더
        if (!current[part]) {
          current[part] = { __type: "folder", __children: {} };
        }
        current = current[part].__children;
      }
    }
  });

  // 재귀적으로 FileStructure[]로 변환
  function toFileStructure(obj: Record<string, any>): FileStructure[] {
    return Object.entries(obj).map(([name, value]) => {
      if (value.__type === "folder") {
        return {
          type: "folder",
          name,
          children: toFileStructure(value.__children),
        };
      } else {
        return {
          type: "file",
          name,
        };
      }
    });
  }

  return toFileStructure(root);
}

export default function SideBar() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { name, fileTree } = useProjectStore();

  const fileTreeStructure: FileStructure[] = convertToFileStructure(fileTree);

  const toggleFolder = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const renderItems = (items: FileStructure[]): React.ReactNode => {
    return items.map((item, index) => {
      if (item.type === "folder") {
        const isOpen = expanded[item.name];
        return (
          <div key={index}>
            <div
              className="flex items-center gap-2 cursor-pointer px-2 py-1 hover:bg-gray-200"
              onClick={() => toggleFolder(item.name)}
            >
              <span className="text-xs w-3">{isOpen ? "˅" : ">"}</span>
              <img
                src="public/components/SideBar/Folder.png"
                alt="Folder"
                width={16}
                height={16}
              />
              <span>{item.name}</span>
            </div>
            {isOpen && <div className="ml-6">{renderItems(item.children)}</div>}
          </div>
        );
      }

      return (
        <div
          key={index}
          className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100"
        >
          <img
            src="public/components/SideBar/File.png"
            alt="File"
            width={16}
            height={16}
          />
          <span>{item.name}</span>
        </div>
      );
    });
  };

  return (
    <div className="w-60 bg-white border-r border-gray-300 flex flex-col">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between p-2 border-b border-gray-300">
        <span className="font-bold">{name}</span>
        <div className="flex gap-2">
          <button className="p-1 rounded hover:bg-gray-200">
            <img
              src="public/components/SideBar/AddFile.png"
              alt="Add File"
              width={16}
              height={16}
            />
          </button>
          <button className="p-1 rounded hover:bg-gray-200">
            <img
              src="public/components/SideBar/AddFolder.png"
              alt="Add Folder"
              width={16}
              height={16}
            />
          </button>
        </div>
      </div>

      {/* 파일 구조 */}
      <div className="flex-1 overflow-y-auto">{renderItems(fileTreeStructure)}</div>
    </div>
  );
}
