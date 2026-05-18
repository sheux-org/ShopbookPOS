import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  isBackupEnabled: boolean;
  toggleBackup: () => void;
  setBackupEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isBackupEnabled: false,
      toggleBackup: () => set((state) => ({ isBackupEnabled: !state.isBackupEnabled })),
      setBackupEnabled: (enabled) => set({ isBackupEnabled: enabled }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
