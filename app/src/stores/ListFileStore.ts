import { create } from 'zustand';

export interface ListFile {
  filePath: string;
  rows: ListFileRow[];
}

export interface ListFileRow {
  addressHex: string;
  rawCodeHex: string;
  rawCodeBinary: string;
  label: string;
  instr: string;
  instrHex: string;
  instrBin: string;
  nixbpe: string;
  operand: string;
  comment: string;
  labelWidth: number;
  nameWidth: number;
  isCommentRow: boolean;
}

interface ListFileState {
  listFile: ListFile[];
  setListFile: (filePath: string, rows: ListFileRow[]) => void;
  addListFile: (filePath: string, rows: ListFileRow[]) => void;
  clearListFile: () => void;
}

export const useListFileStore = create<ListFileState>(set => ({
  listFile: [],
  setListFile: (filePath, rows) =>
    set(state => ({ listFile: [...state.listFile, { filePath, rows }] })),
  addListFile: (filePath, rows) =>
    set(state => ({
      listFile: [...state.listFile, { filePath, rows: [...rows] }],
    })),
  clearListFile: () => set({ listFile: [] }),
}));
