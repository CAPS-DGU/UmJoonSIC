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

//operand Hex transfer
const processOperand = (operand: string): string => {
  if (!isNaN(Number(operand)) && operand.trim() !== '') {
    return Number(operand).toString(16).toUpperCase();
  }
  return operand; // if string -> return
};

// Merged rows
const processRows = (rows: ListFileRow[]): ListFileRow[] =>
  rows.map(row => ({
    ...row,
    // operand: processOperand(row.operand),
    operand: (row.operand),
    // nixbpe: '0', // NIXBPE를 0으로 초기화
  }));

export const useListFileStore = create<ListFileState>(set => ({
  listFile: [],
  setListFile: (filePath, rows) =>
    set(state => ({
      listFile: [...state.listFile, { filePath, rows: processRows(rows) }],
    })),
  addListFile: (filePath, rows) =>
    set(state => ({
      listFile: [...state.listFile, { filePath, rows: processRows(rows) }],
    })),
  clearListFile: () => set({ listFile: [] }),
}));
