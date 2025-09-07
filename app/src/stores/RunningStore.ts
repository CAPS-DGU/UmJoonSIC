import { create } from 'zustand';
import { useProjectStore } from './ProjectStore';
import path from 'path-browserify';
import axios from 'axios';
import { useListFileStore, type ListFileRow } from './ListFileStore';
import { useWatchStore } from './pannel/WatchStore';
import { useRegisterStore } from './RegisterStore';
import { useEditorTabStore, type EditorTab } from './EditorTabStore';
import { useMemoryViewStore } from './MemoryViewStore';
import { useErrorStore } from './pannel/ErrorStore';
import { useModalStore } from '@/stores/ModalStore';
import type { AssemblerError, LinkerError } from '@/types/DTO';
import { toProjectRelativePath } from '@/lib/file-name';

interface RunningState {
  isRunning: boolean;
  isPaused: boolean;
  isReady: boolean;
  loadedFiles: LoadedFile[];
  setIsRunning: (isRunning: boolean) => void;
  toggleIsRunning: () => void;
  fetchBegin: () => void;
  fetchLoad: () => Promise<void>;
  setLoadedFiles: (files: LoadedFile[]) => void;
  loadToListfileAndWatch: () => void;
  stopRunning: () => void;
  setIsPaused: (isPaused: boolean) => void;
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
  assemblerErrors?: AssemblerError[];
  linkerError?: LinkerError;
}

export const useRunningStore = create<RunningState>((set, get) => ({
  isRunning: false,
  isPaused: true,
  isReady: false,
  loadedFiles: [],
  setIsPaused: isPaused => set({ isPaused }),
  setIsRunning: isRunning => set({ isRunning }),
  toggleIsRunning: () => set(state => ({ isRunning: !state.isRunning })),
  setLoadedFiles: (files: LoadedFile[]) => set({ loadedFiles: files }),
  fetchBegin: async () => {
    const { mode } = useMemoryViewStore.getState();
    console.log('mode: ', mode);
    const res = await axios.post('http://localhost:9090/begin', { type: mode.toLowerCase() });
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
    const { fetchBegin, loadToListfileAndWatch, stopRunning } = get();
    const { addErrors, clearErrors } = useErrorStore.getState();

    await fetchBegin();
    const res = await axios.post('http://localhost:9090/load', {
      filePaths: settings.asm.map(file => path.join(projectPath, file)),
      outputDir: path.join(projectPath, '.out'),
      main: settings.main == '' ? undefined : settings.main,
    });
    const data = res.data;
    console.log('load response: ', data);

    if (data.ok) {
      clearErrors(undefined, 'load'); // 이전 load 에러 정리
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
      // 실패 → 에러 스토어에 기록
      try {
        const files: LoadedFile[] = data.files;
        const { addTab, setActiveTab } = useEditorTabStore.getState();

        files.forEach(file => {
          if (file.assemblerErrors?.length) {
            addErrors(
              file.fileName,
              file.assemblerErrors.map(err => ({
                row: err.row,
                col: err.col,
                length: err.length,
                message: err.message,
                type: 'load',
              })),
            );
          }
          if (file.linkerError) {
            useModalStore
              .getState()
              .show(
                '링커 에러',
                `[에러 발생 단계: ${file.linkerError.phase}]\n${file.linkerError.msg}`,
              );
          }
        });

        const firstErrorFile = files
          .map(file => {
            if (file.assemblerErrors?.length) {
              return { file, err: file.assemblerErrors[0] };
            }
            return null;
          })
          .find(Boolean); // null이 아닌 첫 번째 요소 반환

        if (firstErrorFile) {
          const { file, err } = firstErrorFile;
          const tabs = useEditorTabStore.getState().tabs as EditorTab[];

          const tabExists = tabs.find(t => t.filePath === file.fileName);
          const relativeFileName = toProjectRelativePath(projectPath, file.fileName);
          if (!tabExists) {
            addTab({
              idx: tabs.length,
              title: relativeFileName.split('/').pop()!,
              filePath: relativeFileName,
              isModified: false,
              isActive: true,
              fileContent: '',
              breakpoints: [],
              cursor: { line: err.row, column: err.col },
            });
          }

          const tabIdx = tabs.findIndex(t => t.filePath === file.fileName);
          if (tabIdx !== -1) setActiveTab(tabIdx);
        }

        stopRunning();
      } catch (e) {
        console.error('Failed to parse load error response', e);
      }
    }
  },
  loadToListfileAndWatch: async () => {
    const { loadedFiles } = get();
    const { addWatch, fetchVarMemoryValue } = useWatchStore.getState();
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
      fetchVarMemoryValue();
    });
  },
  stopRunning: async () => {
    const { clearListFile } = useListFileStore.getState();
    const { closeAllListFileTabs } = useEditorTabStore.getState();
    const { clearWatch } = useWatchStore.getState();
    const { mode } = useMemoryViewStore.getState();
    const res = await axios.post('http://localhost:9090/begin', { type: mode.toLowerCase() });
    const data = res.data;
    if (data.ok) {
      clearListFile();
      closeAllListFileTabs();
      clearWatch();
      set({ isPaused: false });
      set({ isRunning: false, isReady: false, loadedFiles: [] });
    } else {
      console.error('Failed to stop');
    }
  },
}));
