import { create } from 'zustand';

interface SyncState {
  isSyncing: boolean;
  syncSuccess: boolean | null;
  hasCompletedInitialSync: boolean;
  setSyncing: (isSyncing: boolean) => void;
  setSyncSuccess: (success: boolean | null) => void;
  setHasCompletedInitialSync: (completed: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  syncSuccess: null,
  hasCompletedInitialSync: false,
  setSyncing: (isSyncing) => set({ isSyncing }),
  setSyncSuccess: (syncSuccess) => set({ syncSuccess }),
  setHasCompletedInitialSync: (hasCompletedInitialSync) => set({ hasCompletedInitialSync }),
}));
