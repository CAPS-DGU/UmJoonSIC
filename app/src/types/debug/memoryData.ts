export type MemoryNodeStatus = 'normal' | 'red bold' | 'highlighted' | 'underlined';

export interface MemoryNodeData {
  value: string;
  status: MemoryNodeStatus;
}
