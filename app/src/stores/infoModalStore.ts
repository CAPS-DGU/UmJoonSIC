// A simple message box inside the page (InfoModal), for messages such as a linker error.
import { create } from 'zustand';

interface ModalState {
  isOpen: boolean;
  title?: string;
  message?: string;
  show: (title: string, message: string) => void;
  close: () => void;
}

export const useInfoModalStore = create<ModalState>(set => ({
  isOpen: false,
  title: undefined,
  message: undefined,
  show: (title: string, message: string) => set({ isOpen: true, title, message }),
  close: () => set({ isOpen: false, title: undefined, message: undefined }),
}));
