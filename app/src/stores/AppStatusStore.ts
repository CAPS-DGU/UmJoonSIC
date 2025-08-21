import { create } from 'zustand';

interface AppStatusState {
  isLoading: boolean;
  isBackendConnected: boolean;
  setIsLoading: (isLoading: boolean) => void;
  setIsBackendConnected: (isBackendConnected: boolean) => void;
}

export const useAppStatusStore = create<AppStatusState>(set => ({
  isLoading: false,
  isBackendConnected: false,
  setIsLoading: isLoading => set({ isLoading }),
  setIsBackendConnected: isBackendConnected => set({ isBackendConnected }),
}));
