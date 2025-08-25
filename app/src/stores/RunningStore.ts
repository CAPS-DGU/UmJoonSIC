import { create } from 'zustand';
import { useProjectStore } from './ProjectStore';
import path from 'path-browserify';
import axios from 'axios';
import { useListFileStore, type ListFileRow } from './ListFileStore';
import { useWatchStore } from './pannel/WatchStore';
import { useRegisterStore } from './RegisterStore';
import { useEditorTabStore } from './EditorTabStore';
import { useMemoryViewStore } from './MemoryViewStore';

interface RunningState {
  isRunning: boolean;
  isReady: boolean;
  loadedFiles: LoadedFile[];
  setIsRunning: (isRunning: boolean) => void;
  toggleIsRunning: () => void;
  fetchBegin: () => void;
  fetchLoad: () => void;
  setLoadedFiles: (files: LoadedFile[]) => void;
  loadToListfileAndWatch: () => void;
  stopRunning: () => void;
}

// Watch 변수 정보
interface WatchVariable {
  name: string;
  address: number;
  dataType: string;
  elementSize: number;
  elementCount: number;
}

// Listing의 각 행 정보
// interface ListingRow {
//   addressHex: string;
//   comment: string;
//   instr: string;
//   instrHex: string;
//   isCommentRow: boolean;
//   label: string;
//   labelWidth: number;
//   nameWidth: number;
//   nixbpe: string;
//   operand: string;
//   rawCodeBinary: string;
//   rawCodeHex: string;
//   instrBin: string;
// }

// Listing 정보
interface Listing {
  codeFileName: string;
  startAddress: number;
  programLength: number;
  rows: ListFileRow[];
  watch: WatchVariable[];
}

// 로드된 파일 정보
interface LoadedFile {
  fileName: string;
  listing: Listing;
  compileErrors: string[] | null;
  linkerError: string | null;
}

export const useRunningStore = create<RunningState>((set, get) => ({
  isRunning: false,
  isReady: false,
  loadedFiles: [],
  setIsRunning: isRunning => set({ isRunning }),
  toggleIsRunning: () => set(state => ({ isRunning: !state.isRunning })),
  setLoadedFiles: (files: LoadedFile[]) => set({ loadedFiles: files }),
  fetchBegin: async () => {
    const res = await axios.post('http://localhost:9090/begin');
    const data = res.data;
    if (data.ok) {
      set({ isReady: true });
    } else {
      console.error('Failed to begin');
    }
  },
  fetchLoad: async () => {
    const { projectPath, settings } = useProjectStore.getState();
    const { setMemoryRange } = useMemoryViewStore.getState();
    const { fetchBegin, loadToListfileAndWatch } = get();
    await fetchBegin();
    const res = await axios.post('http://localhost:9090/load', {
      filePaths: settings.asm.map(file => path.join(projectPath, file)),
      outputDir: path.join(projectPath, '.out'),
      main: settings.main == '' ? undefined : settings.main,
    });
    const data = res.data;
    if (data.ok) {
      const { setAll } = useRegisterStore.getState();
      setAll(data.registers);
      const files: LoadedFile[] = data.files;
      setMemoryRange({
        start: data.registers.PC,
        end: data.registers.PC + 256,
      });
      set({ loadedFiles: files });
      loadToListfileAndWatch();
    } else {
      console.error('Failed to load');
    }
  },
  loadToListfileAndWatch: async () => {
    const { loadedFiles } = get();
    const { addWatch } = useWatchStore.getState();
    const { addListFile } = useListFileStore.getState();
    const { addTab } = useEditorTabStore.getState();
    loadedFiles.forEach(file => {
      addTab({
        idx: 0,
        title: `List: ${file.fileName.split('/').pop()!}`,
        filePath: path.join(file.fileName + '.lst'),
        isModified: false,
        isActive: true,
        fileContent: '',
        breakpoints: [],
        cursor: {
          line: 0,
          column: 0,
        },
      });
      console.log(file.fileName, file.listing.rows);
      addListFile(file.fileName, file.listing.rows);
      file.listing.watch.forEach(w => {
        addWatch({
          filePath: file.fileName,
          name: w.name,
          address: w.address,
          dataType: w.dataType,
          elementSize: w.elementSize,
          elementCount: w.elementCount,
        });
      });
    });
  },
  stopRunning: async () => {
    const { clearListFile } = useListFileStore.getState();
    const { clearWatch } = useWatchStore.getState();
    const res = await axios.post('http://localhost:9090/begin');
    const data = res.data;
    if (data.ok) {
      clearListFile();
      clearWatch();
      set({ isRunning: false, isReady: false, loadedFiles: [] });
    } else {
      console.error('Failed to stop');
    }
  },
}));
