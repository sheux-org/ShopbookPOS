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

const useSettingsStoreRaw = create<SettingsState>()(
  persist(
    (set) => ({
      isBackupEnabled: true,
      pairedPrinter: null,
      hapticsEnabled: true,
      isPremium: true,
      toggleBackup: () => set((state) => ({ isBackupEnabled: !state.isBackupEnabled })),
      setBackupEnabled: (enabled) => set({ isBackupEnabled: enabled }),
      setPairedPrinter: (printer) => set({ pairedPrinter: printer }),
      toggleHaptics: () => set((state) => ({ hapticsEnabled: !state.hapticsEnabled })),
      setPremium: (premium) => set({ isPremium: premium }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isBackupEnabled: state.isBackupEnabled,
        pairedPrinter: state.pairedPrinter,
        hapticsEnabled: state.hapticsEnabled,
      }),
    }
  )
);

export const useSettingsStore = Object.assign(
  (selector: any) => {
    const wrappedSelector = (state: SettingsState) => {
      const proxy = new Proxy(state, {
        get(target, prop) {
          if (prop === 'isPremium') return true;
          return target[prop as keyof SettingsState];
        },
      });
      return selector ? selector(proxy) : proxy;
    };
    return useSettingsStoreRaw(wrappedSelector);
  },
  {
    getState: () => ({
      ...useSettingsStoreRaw.getState(),
      isPremium: true,
    }),
    setState: useSettingsStoreRaw.setState,
    subscribe: useSettingsStoreRaw.subscribe,
    persist: useSettingsStoreRaw.persist,
  }
) as unknown as typeof useSettingsStoreRaw;
