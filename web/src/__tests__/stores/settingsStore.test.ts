import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '../../stores/settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      isBackupEnabled: true,
      pairedPrinter: null,
      hapticsEnabled: false,
      isPremium: true,
      posMode: 'tablet',
      sidebarVisible: true,
    });
  });

  test('should initialize with default states', () => {
    const state = useSettingsStore.getState();
    expect(state.isBackupEnabled).toBe(true);
    expect(state.pairedPrinter).toBeNull();
    expect(state.hapticsEnabled).toBe(false);
    expect(state.isPremium).toBe(true);
    expect(state.posMode).toBe('tablet');
    expect(state.sidebarVisible).toBe(true);
  });

  test('should toggle backup state', () => {
    useSettingsStore.getState().toggleBackup();
    expect(useSettingsStore.getState().isBackupEnabled).toBe(false);

    useSettingsStore.getState().toggleBackup();
    expect(useSettingsStore.getState().isBackupEnabled).toBe(true);
  });

  test('should set backup explicitly', () => {
    useSettingsStore.getState().setBackupEnabled(false);
    expect(useSettingsStore.getState().isBackupEnabled).toBe(false);
  });

  test('should pair and clear printer details', () => {
    const printer = { name: 'Epson POS-80', address: '00:11:22:33:44:55' };
    useSettingsStore.getState().setPairedPrinter(printer);
    expect(useSettingsStore.getState().pairedPrinter).toEqual(printer);

    useSettingsStore.getState().setPairedPrinter(null);
    expect(useSettingsStore.getState().pairedPrinter).toBeNull();
  });

  test('should toggle haptics', () => {
    useSettingsStore.getState().toggleHaptics();
    expect(useSettingsStore.getState().hapticsEnabled).toBe(true);
  });

  test('should set premium state', () => {
    useSettingsStore.getState().setPremium(false);
    expect(useSettingsStore.getState().isPremium).toBe(false);
  });

  test('should switch POS mode', () => {
    useSettingsStore.getState().setPosMode('normal');
    expect(useSettingsStore.getState().posMode).toBe('normal');
  });

  test('should switch sidebar visibility', () => {
    useSettingsStore.getState().setSidebarVisible(false);
    expect(useSettingsStore.getState().sidebarVisible).toBe(false);
  });

  test('should support SSR environments where window is undefined', async () => {
    vi.resetModules();
    const originalWindow = global.window;
    
    Object.defineProperty(global, 'window', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    
    const { useSettingsStore: ssrStore } = await import('../../stores/settingsStore');
    expect(ssrStore).toBeDefined();
    
    // Restore window
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });
});
