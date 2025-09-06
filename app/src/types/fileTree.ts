export type FileItem = { type: 'file'; name: string; relativePath: string };

export type FolderItem = {
  type: 'folder';
  name: string;
  children: FileStructure[];
  relativePath: string;
};

export type FileStructure = FileItem | FolderItem;
