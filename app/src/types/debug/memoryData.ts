export type MemoryNodeStatus = 'normal' | 'highlighted' | 'red bold';

export interface MemoryNodeData {
  value: string; // 실제 값 (0~255)
  status?: MemoryNodeStatus; // 표시 상태
}

export interface MemoryLabel {
  start: number;
  end: number;
  name: string;
}
