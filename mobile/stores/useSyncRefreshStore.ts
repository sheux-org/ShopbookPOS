import { create } from 'zustand';

interface SyncRefreshState {
  version: number;
  bump: () => void;
}

export const useSyncRefreshStore = create<SyncRefreshState>((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));
