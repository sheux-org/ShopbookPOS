import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PrinterDevice {
  name: string;
  address: string;
}

type ThermalPaperWidth = 58 | 80;
type CashDrawerPin = '2pin' | '5pin';

interface SettingsState {
  isBackupEnabled: boolean;
  pairedPrinter: PrinterDevice | null;
  hapticsEnabled: boolean;
  isPremium: boolean;
  posMode: 'tablet' | 'normal';
  sidebarVisible: boolean;
  // Thermal printer preferences (printed via the Chittie Companion)
  thermalPaperWidth: ThermalPaperWidth;
  // Cash drawer (kicked via the printer's drawer port over ESC/POS)
  cashDrawerPin: CashDrawerPin;
  openDrawerOnCashSale: boolean;
  toggleBackup: () => void;
  setBackupEnabled: (enabled: boolean) => void;
  setPairedPrinter: (printer: PrinterDevice | null) => void;
  toggleHaptics: () => void;
  setPremium: (premium: boolean) => void;
  setPosMode: (mode: 'tablet' | 'normal') => void;
  setSidebarVisible: (visible: boolean) => void;
  setThermalPaperWidth: (width: ThermalPaperWidth) => void;
  setCashDrawerPin: (pin: CashDrawerPin) => void;
  setOpenDrawerOnCashSale: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isBackupEnabled: true, // Default to true on web for premium ease
      pairedPrinter: null,
      hapticsEnabled: false, // Haptics not applicable on desktop browser
      isPremium: true, // Exclusively premium web client!
      posMode: 'tablet', // Default to Tablet POS Mode
      sidebarVisible: true, // Default to true (sidebar ON)
      thermalPaperWidth: 80, // 80mm rolls are the common desktop POS size
      cashDrawerPin: '2pin', // most drawers use the 2-pin kick
      openDrawerOnCashSale: true,
      toggleBackup: () => set((state) => ({ isBackupEnabled: !state.isBackupEnabled })),
      setBackupEnabled: (enabled) => set({ isBackupEnabled: enabled }),
      setPairedPrinter: (printer) => set({ pairedPrinter: printer }),
      toggleHaptics: () => set((state) => ({ hapticsEnabled: !state.hapticsEnabled })),
      setPremium: (premium) => set({ isPremium: premium }),
      setPosMode: (mode) => set({ posMode: mode }),
      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
      setThermalPaperWidth: (width) => set({ thermalPaperWidth: width }),
      setCashDrawerPin: (pin) => set({ cashDrawerPin: pin }),
      setOpenDrawerOnCashSale: (enabled) => set({ openDrawerOnCashSale: enabled }),
    }),
    {
      name: 'settings-storage',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
    }
  )
);
