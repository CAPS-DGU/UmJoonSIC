export interface ConsoleMessage {
  id: string; // 고유 id, 추가 함수에서 알아서 넣음
  type: 'error' | 'out';
  message: string;
  timestamp: number; // 추가 함수에서 알아서 넣음
}
