import { create } from 'zustand';

export interface ListFileRow {
  addressHex: number;
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
  listFile: ListFileRow[];
  setListFile: (listFile: ListFileRow[]) => void;
}

export const useListFileStore = create<ListFileState>(set => ({
  listFile: [],
  setListFile: listFile => set({ listFile }),
}));
