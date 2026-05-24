import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PrinterDevice {
  name: string;
  address: string;
}

interface SettingsState {
  isBackupEnabled: boolean;
  pairedPrinter: PrinterDevice | null;
  hapticsEnabled: boolean;
  isPremium: boolean;
  toggleBackup: () => void;
  setBackupEnabled: (enabled: boolean) => void;
  setPairedPrinter: (printer: PrinterDevice | null) => void;
  toggleHaptics: () => void;
  setPremium: (premium: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isBackupEnabled: false,
      pairedPrinter: null,
      hapticsEnabled: true,
      isPremium: false,
      toggleBackup: () => set((state) => ({ isBackupEnabled: !state.isBackupEnabled })),
      setBackupEnabled: (enabled) => set({ isBackupEnabled: enabled }),
      setPairedPrinter: (printer) => set({ pairedPrinter: printer }),
      toggleHaptics: () => set((state) => ({ hapticsEnabled: !state.hapticsEnabled })),
      setPremium: (premium) => set({ isPremium: premium }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
