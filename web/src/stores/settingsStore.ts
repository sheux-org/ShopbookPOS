import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PrinterDevice {
  name: string;
  address: string;
}

interface SettingsState {
  isBackupEnabled: boolean;
  pairedPrinter: PrinterDevice | null;
  hapticsEnabled: boolean;
  isPremium: boolean;
  posMode: 'tablet' | 'normal';
  sidebarVisible: boolean;
  toggleBackup: () => void;
  setBackupEnabled: (enabled: boolean) => void;
  setPairedPrinter: (printer: PrinterDevice | null) => void;
  toggleHaptics: () => void;
  setPremium: (premium: boolean) => void;
  setPosMode: (mode: 'tablet' | 'normal') => void;
  setSidebarVisible: (visible: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isBackupEnabled: true, // Default to true on web for premium ease
      pairedPrinter: null,
      hapticsEnabled: false, // Haptics not applicable on desktop browser
      isPremium: true,       // Exclusively premium web client!
      posMode: 'tablet',     // Default to Tablet POS Mode
      sidebarVisible: true,  // Default to true (sidebar ON)
      toggleBackup: () => set((state) => ({ isBackupEnabled: !state.isBackupEnabled })),
      setBackupEnabled: (enabled) => set({ isBackupEnabled: enabled }),
      setPairedPrinter: (printer) => set({ pairedPrinter: printer }),
      toggleHaptics: () => set((state) => ({ hapticsEnabled: !state.hapticsEnabled })),
      setPremium: (premium) => set({ isPremium: premium }),
      setPosMode: (mode) => set({ posMode: mode }),
      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
    }),
    {
      name: 'settings-storage',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
    }
  )
);
