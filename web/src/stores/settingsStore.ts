import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PrinterDevice {
  name: string;
  address: string;
}

// chittie's own profile keys and drawer-pin numbering — no local dialect to translate.
type PrinterProfile = '58mm' | '80mm';
type CashDrawerDevice = 0 | 1; // 0 = connector pin 2, 1 = pin 5

interface SettingsState {
  isBackupEnabled: boolean;
  pairedPrinter: PrinterDevice | null;
  hapticsEnabled: boolean;
  isPremium: boolean;
  posMode: 'tablet' | 'normal';
  sidebarVisible: boolean;
  // Thermal printer preferences (printed via the Chittie Companion)
  printerProfile: PrinterProfile;
  // Cash drawer (kicked via the printer's drawer port over ESC/POS)
  cashDrawerDevice: CashDrawerDevice;
  openDrawerOnCashSale: boolean;
  toggleBackup: () => void;
  setBackupEnabled: (enabled: boolean) => void;
  setPairedPrinter: (printer: PrinterDevice | null) => void;
  toggleHaptics: () => void;
  setPremium: (premium: boolean) => void;
  setPosMode: (mode: 'tablet' | 'normal') => void;
  setSidebarVisible: (visible: boolean) => void;
  setPrinterProfile: (profile: PrinterProfile) => void;
  setCashDrawerDevice: (device: CashDrawerDevice) => void;
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
      printerProfile: '80mm', // 80mm rolls are the common desktop POS size
      cashDrawerDevice: 0, // most drawers use the pin-2 kick
      openDrawerOnCashSale: true,
      toggleBackup: () => set((state) => ({ isBackupEnabled: !state.isBackupEnabled })),
      setBackupEnabled: (enabled) => set({ isBackupEnabled: enabled }),
      setPairedPrinter: (printer) => set({ pairedPrinter: printer }),
      toggleHaptics: () => set((state) => ({ hapticsEnabled: !state.hapticsEnabled })),
      setPremium: (premium) => set({ isPremium: premium }),
      setPosMode: (mode) => set({ posMode: mode }),
      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
      setPrinterProfile: (profile) => set({ printerProfile: profile }),
      setCashDrawerDevice: (device) => set({ cashDrawerDevice: device }),
      setOpenDrawerOnCashSale: (enabled) => set({ openDrawerOnCashSale: enabled }),
    }),
    {
      name: 'settings-storage',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
      version: 1,
      // v0 stored a paper width in mm and a '2pin'/'5pin' label. Carry a till's
      // saved choice across rather than silently resetting it to 80mm/pin 2.
      migrate: (persisted, version) => {
        if (version >= 1) return persisted as SettingsState;
        const old = (persisted ?? {}) as Record<string, unknown>;
        const { thermalPaperWidth, cashDrawerPin, ...rest } = old;
        return {
          ...rest,
          printerProfile: thermalPaperWidth === 58 ? '58mm' : '80mm',
          cashDrawerDevice: cashDrawerPin === '5pin' ? 1 : 0,
        } as SettingsState;
      },
    }
  )
);
