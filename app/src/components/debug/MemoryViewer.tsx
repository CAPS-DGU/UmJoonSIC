import {
  useMemoryViewStore,
  type MachineMode,
  type MemoryNodeData,
  type MemoryNodeStatus,
  type MemoryLabel,
} from '@/stores/MemoryViewStore';
import { useEffect, useRef, useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import '/src/styles/SearchAnimation.css';
export default function MemoryViewer() {
  const memoryValues = useMemoryViewStore(state => state.memoryValues);
  const getMemoryLabelFromWatch = useMemoryViewStore(state => state.getMemoryLabelFromWatch);
  const labels = getMemoryLabelFromWatch();
  const changedNodes = useMemoryViewStore(state => state.changedNodes);
  const clearChangedNodes = useMemoryViewStore(state => state.clearChangedNodes);
  const visibleRange = useMemoryViewStore(state => state.visibleRange);
  const totalMemorySize = useMemoryViewStore(state => state.totalMemorySize);
  const loadMemoryRange = useMemoryViewStore(state => state.loadMemoryRange);
  const getMemoryValue = useMemoryViewStore(state => state.getMemoryValue);
  const memoryRange = useMemoryViewStore(state => state.memoryRange);
  const containerRef = useRef<HTMLDivElement>(null);
  const ROW_SIZE = 8;
  const BUFFER_SIZE = 512; // 미리 로드할 범위 (위아래 256바이트씩)
  const ROW_HEIGHT = 32; // 각 행의 높이

  const [searchAddress, setSearchAddress] = useState('');
  const [visibleRowRange, setVisibleRowRange] = useState({ start: 0, end: 20 });
  const [searchedNodes, setSearchedNodes] = useState<Set<number>>(new Set());

  // 애니메이션 완료 후 변경된 노드 목록 초기화
  useEffect(() => {
    if (changedNodes.size > 0) {
      const timer = setTimeout(() => {
        clearChangedNodes();
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [changedNodes, clearChangedNodes]);

  // 검색된 노드 애니메이션 초기화
  useEffect(() => {
    if (searchedNodes.size > 0) {
      const timer = setTimeout(() => {
        setSearchedNodes(new Set());
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [searchedNodes]);

  //메모리 범위 변경 확인
  useEffect(() => {
    // memoryRange가 바뀌면 새 범위 로드
    loadMemoryRange(memoryRange.start, memoryRange.end);
  }, [memoryRange, loadMemoryRange]);

  // 스크롤 이벤트 핸들러
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    // 현재 보이는 행 범위 계산
    const startRow = Math.floor(scrollTop / ROW_HEIGHT);
    const endRow = Math.min(
      Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT),
      Math.ceil(totalMemorySize / ROW_SIZE),
    );

    setVisibleRowRange({ start: startRow, end: endRow });

    // 현재 보이는 메모리 범위 계산
    const visibleStart = startRow * ROW_SIZE;
    const visibleEnd = Math.min(
      scrollTop / ROW_HEIGHT + containerHeight / ROW_HEIGHT,
      (memoryRange.end - memoryRange.start + 1) / ROW_SIZE,
    );

    // 버퍼를 포함한 로드 범위 계산
    const loadStart = Math.max(0, visibleStart - BUFFER_SIZE);
    const loadEnd = Math.min(totalMemorySize, visibleEnd + BUFFER_SIZE);

    // 필요한 메모리 범위 로드
    loadMemoryRange(loadStart, loadEnd);
  }, [loadMemoryRange, totalMemorySize, ROW_HEIGHT, ROW_SIZE]);

  // 초기 로드
  useEffect(() => {
    loadMemoryRange(0, BUFFER_SIZE);
  }, [loadMemoryRange]);

  // 스크롤 이벤트 리스너 등록
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // 디버깅: 메모리 값 확인
  const handleDebugMemory = () => {
    console.log('현재 로드된 메모리 값들:', memoryValues.slice(0, 20));
    console.log('주소 0x0000의 값:', getMemoryValue(0));
    console.log('주소 0x0008의 값:', getMemoryValue(8));
    console.log('주소 0x0010의 값:', getMemoryValue(16));
  };
  const handleSearch = () => {
    if (!containerRef.current || !searchAddress) return;

    const address = parseInt(searchAddress, 16);
    if (isNaN(address) || address < 0 || address >= totalMemorySize) {
      alert('유효하지 않은 메모리 주소입니다.');
      return;
    }

    // 검색된 노드 목록에 추가
    setSearchedNodes(new Set([address]));

    const rowIndex = Math.floor(address / ROW_SIZE);
    const scrollTo = rowIndex * ROW_HEIGHT;

    // 스크롤 위치 이동
    containerRef.current.scrollTop = scrollTo;

    // 해당 범위의 메모리 로드
    loadMemoryRange(address, address + BUFFER_SIZE);
  };

  // 전체 메모리 크기에 따른 스크롤 영역 생성
  const totalRows = Math.ceil(totalMemorySize / ROW_SIZE);

  return (
    <section className="flex flex-col px-2">
      <div className="flex justify-between items-center">
        <h2 className="text-md font-bold">메모리 뷰어</h2>
        {/* <button
          onClick={handleDebugMemory}
          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          디버그
        </button> */}
      </div>

      <div className="flex items-center mt-2 space-x-2">
        <input
          type="text"
          value={searchAddress}
          onChange={e => setSearchAddress(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
          placeholder="16진수 주소 입력 (예: 0x1A2B)"
          className="border border-gray-300 p-1 rounded text-sm w-48 font-mono"
        />
        <button
          onClick={handleSearch}
          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          <Search size={16} />
        </button>
      </div>

      <div
        ref={containerRef}
        className="w-full mt-2 flex justify-start items-start px-2 overflow-y-auto flex-1 min-h-0 h-full max-h-[700px]"
      >
        <div
          className="flex border-r border-gray-300 pr-1 text-green-500"
          style={{ height: `${totalRows * ROW_HEIGHT}px` }}
        >
          <KeyColumn
            totalRows={totalRows}
            visibleRowRange={visibleRowRange}
            ROW_SIZE={ROW_SIZE}
            ROW_HEIGHT={ROW_HEIGHT}
          />
          <div className="flex flex-col text-black">
            <ValueColumn
              totalRows={totalRows}
              visibleRowRange={visibleRowRange}
              labels={labels}
              changedNodes={changedNodes}
              getMemoryValue={getMemoryValue}
              ROW_SIZE={ROW_SIZE}
              ROW_HEIGHT={ROW_HEIGHT}
              searchedNodes={searchedNodes}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function KeyColumn({
  totalRows,
  visibleRowRange,
  ROW_SIZE,
  ROW_HEIGHT,
}: {
  totalRows: number;
  visibleRowRange: { start: number; end: number };
  ROW_SIZE: number;
  ROW_HEIGHT: number;
}) {
  // 보이는 행만 렌더링
  const visibleRows = [];
  for (let i = visibleRowRange.start; i < visibleRowRange.end; i++) {
    if (i < totalRows) {
      visibleRows.push(i);
    }
  }

  return (
    <div className="flex flex-col gap-2 pr-4 relative">
      {visibleRows.map(rowIndex => {
        // 주소 계산: 행 인덱스 * 행 크기
        const addr = rowIndex * ROW_SIZE;
        return (
          <p
            key={rowIndex}
            className="text-sm font-normal font-mono flex items-center"
            style={{
              height: `${ROW_HEIGHT}px`,
              position: 'absolute',
              top: `${rowIndex * ROW_HEIGHT - 6}px`,
            }}
          >
            {addr.toString(16).toUpperCase().padStart(4, '0')}
          </p>
        );
      })}
    </div>
  );
}

function ValueColumn({
  totalRows,
  visibleRowRange,
  labels,
  changedNodes,
  getMemoryValue,
  ROW_SIZE,
  ROW_HEIGHT,
  searchedNodes,
}: {
  totalRows: number;
  visibleRowRange: { start: number; end: number };
  labels: MemoryLabel[];
  changedNodes: Set<number>;
  getMemoryValue: (address: number) => MemoryNodeData | null;
  ROW_SIZE: number;
  ROW_HEIGHT: number;
  searchedNodes: Set<number>; // Props로 전달
}) {
  // 보이는 행만 렌더링
  const visibleRows = [];
  for (let i = visibleRowRange.start; i < visibleRowRange.end; i++) {
    if (i < totalRows) {
      visibleRows.push(i);
    }
  }

  return (
    <div className="flex flex-col gap-2 pl-4 relative">
      {visibleRows.map(rowIndex => {
        // 주소 계산: 행 인덱스 * 행 크기 (KeyColumn과 동일)
        const rowStartAddr = rowIndex * ROW_SIZE;
        const rowEndAddr = Math.min(rowStartAddr + ROW_SIZE - 1, totalRows * ROW_SIZE - 1);

        // 이 행에 포함되는 라벨만
        const rowLabels = labels
          .filter(l => l.end >= rowStartAddr && l.start <= rowEndAddr)
          .map(l => ({
            ...l,
            start: Math.max(l.start, rowStartAddr) - rowStartAddr,
            end: Math.min(l.end, rowEndAddr) - rowStartAddr,
          }));

        return (
          <div
            key={rowIndex}
            className="flex flex-col space-y-1 relative"
            style={{
              height: `${ROW_HEIGHT}px`,
              position: 'absolute',
              top: `${rowIndex * ROW_HEIGHT}px`,
            }}
          >
            {/* 값 */}
            <div className="flex relative mb-2">
              {Array.from({ length: ROW_SIZE }, (_, idx) => {
                // 각 바이트의 주소: 행 시작 주소 + 바이트 인덱스
                const byteAddr = rowStartAddr + idx;
                const node = getMemoryValue(byteAddr);
                const label = rowLabels.find(l => idx >= l.start && idx <= l.end);
                const isChanged = changedNodes.has(byteAddr);
                // 검색된 노드 여부
                const isSearched = searchedNodes.has(byteAddr);

                // 디버깅: 첫 번째 행의 첫 번째 값만 로그 출력
                if (rowIndex === 0 && idx === 0) {
                  console.log(
                    `행 ${rowIndex}, 바이트 ${idx}: 주소 ${byteAddr.toString(16)}의 값:`,
                    node?.value || '00',
                  );
                }

                return (
                  <MemoryNode
                    key={idx}
                    val={node?.value || '00'}
                    status={node?.status}
                    labelHighlight={!!label}
                    isChanged={isChanged}
                    isSearched={isSearched}
                  />
                );
              })}

              {/* 라벨 밑줄 (모든 라벨에 대해 표시) */}
              {rowLabels.map((label, idx) => {
                // 원본 라벨의 절대 위치 사용
                const originalLabel = labels.find(l => l.name === label.name);
                if (!originalLabel) return null;

                // 현재 행에서의 상대 위치 계산
                const relativeStart = Math.max(originalLabel.start, rowStartAddr) - rowStartAddr;
                const relativeEnd = Math.min(originalLabel.end, rowEndAddr) - rowStartAddr;

                const left = relativeStart * 24 + 4; // w-6 + gap
                const width = (relativeEnd - relativeStart + 1) * 24 - 8;

                return (
                  <div
                    key={`line-${idx}`}
                    className="absolute -bottom-0.5 border-t-2 border-orange-500"
                    style={{ left, width }}
                  />
                );
              })}

              {/* 라벨 이름 (시작하는 행에만 표시) */}
              {rowLabels
                .filter(label => {
                  // 전체 labels 배열에서 이 라벨이 처음 나타나는 행인지 확인
                  const originalLabel = labels.find(l => l.name === label.name);
                  if (!originalLabel) return false;

                  // 원본 라벨의 시작 주소가 현재 행에 속하는지 확인
                  const labelStartRow = Math.floor(originalLabel.start / ROW_SIZE);
                  return labelStartRow === rowIndex;
                })
                .map((label, idx) => {
                  const left = label.start * 24 + 4; // w-6 + gap
                  const width = (label.end - label.start + 1) * 24 - 8;
                  return (
                    <div
                      key={`name-${idx}`}
                      className="absolute -bottom-4 text-xs text-orange-500 text-center font-mono"
                      style={{ left, width }}
                    >
                      {label.name}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MemoryNode({
  val,
  status,
  labelHighlight,
  isChanged,
  isSearched,
}: {
  val: string;
  status?: MemoryNodeStatus;
  labelHighlight?: boolean;
  isChanged?: boolean;
  isSearched?: boolean;
}) {
  const statusClasses = {
    normal: '',
    highlighted: 'bg-yellow-200',
    'red bold': 'text-red-500 font-bold',
  };

  return (
    <span
      className={`font-mono text-sm px-1 w-6 text-center ${
        statusClasses[status || 'normal']
      } ${labelHighlight ? '!text-orange-500 font-semibold' : ''} ${
        isChanged ? 'memory-flash' : ''
      } ${isSearched ? 'search-flash' : ''}`}
    >
      {val}
    </span>
  );
}
