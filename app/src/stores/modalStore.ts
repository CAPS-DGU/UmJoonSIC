import { create } from 'zustand';

interface ModalState {
  isOpen: boolean;
  title?: string;
  message?: string;
  // 상태 변경용 메서드
  show: (title: string, message: string) => void;
  close: () => void;
}

export const useModalStore = create<ModalState>(set => ({
  isOpen: false,
  title: undefined,
  message: undefined,
  show: (title: string, message: string) => set({ isOpen: true, title, message }),
  close: () => set({ isOpen: false, title: undefined, message: undefined }),
}));
