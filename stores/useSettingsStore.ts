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
  toggleBackup: () => void;
  setBackupEnabled: (enabled: boolean) => void;
  setPairedPrinter: (printer: PrinterDevice | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isBackupEnabled: false,
      pairedPrinter: null,
      toggleBackup: () => set((state) => ({ isBackupEnabled: !state.isBackupEnabled })),
      setBackupEnabled: (enabled) => set({ isBackupEnabled: enabled }),
      setPairedPrinter: (printer) => set({ pairedPrinter: printer }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
