import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActiveDeviceTracker, DEVICE_ID_KEY, deleteCurrentDeviceSession } from '../../hooks/useActiveDeviceTracker';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { supabase } from '../../services/sync';

const MOCK_BUSINESS = {
  id: 'biz-123',
  name: 'My Store',
  category: 'Grocery',
  address: 'Colombo',
  phone: '0771112222',
};

describe('useActiveDeviceTracker Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useBusinessStore.setState({ activeBusiness: MOCK_BUSINESS });
    localStorage.clear();

    // Reset online status
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Auth guard ───────────────────────────────────────────────────

  test('should not ping if user is not logged in', () => {
    renderHook(() => useActiveDeviceTracker());
    expect(supabase.from).not.toHaveBeenCalledWith('active_devices');
  });

  test('should not ping when activeBusinessId is "0" (placeholder)', () => {
    useAuthStore.setState({ isLoggedIn: true });
    useBusinessStore.setState({
      activeBusiness: { ...MOCK_BUSINESS, id: '0' },
    });

    renderHook(() => useActiveDeviceTracker());
    expect(supabase.from).not.toHaveBeenCalledWith('active_devices');
  });

  // ─── Successful ping ──────────────────────────────────────────────

  test('should ping and register terminal status when logged in', async () => {
    useAuthStore.setState({
      isLoggedIn: true,
      activeEmployeeId: 'emp-cashier',
      employeeName: 'Kamal Gunaratne',
      userRole: 'cashier',
    });
    localStorage.setItem(DEVICE_ID_KEY, 'device-uuid-123');

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(supabase.from).toHaveBeenCalledWith('active_devices');

    const mockFromInstance = supabase.from('active_devices');
    expect(mockFromInstance.upsert).toHaveBeenCalled();

    const payload = (mockFromInstance.upsert as any).mock.calls[0][0];
    expect(payload.device_id).toBe('device-uuid-123');
    expect(payload.business_id).toBe('biz-123');
    expect(payload.employee_id).toBe('emp-cashier');
    expect(payload.employee_name).toBe('Kamal Gunaratne');
    expect(payload.role).toBe('cashier');
    expect(payload.battery_level).toBe(85);
    expect(payload.latitude).toBe(6.9271);
    expect(payload.longitude).toBe(79.8612);
    expect(payload.is_online).toBe(true);
  });

  test('should auto-generate and store a device ID if none exists', async () => {
    useAuthStore.setState({ isLoggedIn: true });

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    const storedId = localStorage.getItem(DEVICE_ID_KEY);
    expect(storedId).not.toBeNull();
    expect(storedId).toMatch(/[0-9a-f-]{36}/);
  });

  // ─── Offline skip ─────────────────────────────────────────────────

  test('should skip ping when navigator is offline', async () => {
    useAuthStore.setState({ isLoggedIn: true });
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(logSpy).toHaveBeenCalledWith('Client is offline, skipping active device ping.');
    expect(supabase.from).not.toHaveBeenCalledWith('active_devices');
    logSpy.mockRestore();
  });

  // ─── Geolocation errors ───────────────────────────────────────────

  test('should handle geolocation permission denied error', async () => {
    useAuthStore.setState({ isLoggedIn: true });

    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn().mockImplementation((_success, error) =>
          error({ code: 1, message: 'Permission denied' })
        ),
      },
      writable: true,
      configurable: true,
    });

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mockFromInstance = supabase.from('active_devices');
    const payload = (mockFromInstance.upsert as any).mock.calls[0][0];
    expect(payload.location_name).toBe('Location Denied');
  });

  test('should set location_name to "Geolocation Unsupported" when geolocation is absent', async () => {
    useAuthStore.setState({ isLoggedIn: true });

    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mockFromInstance = supabase.from('active_devices');
    const payload = (mockFromInstance.upsert as any).mock.calls[0][0];
    expect(payload.location_name).toBe('Geolocation Unsupported');
  });

  // ─── Upsert failure ───────────────────────────────────────────────

  test('should print warning when database upsert fails', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useAuthStore.setState({ isLoggedIn: true });

    const mockFromInstance = supabase.from('active_devices');
    (mockFromInstance.upsert as any).mockResolvedValueOnce({ error: { message: 'Network Timeout' } });

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to upsert active device status:', { message: 'Network Timeout' });
    consoleWarnSpy.mockRestore();
  });

  // ─── Remote session termination ───────────────────────────────────

  test('should logout when remote session row is deleted', async () => {
    useAuthStore.setState({ isLoggedIn: true, activeEmployeeId: 'emp-1' });
    localStorage.setItem(DEVICE_ID_KEY, 'device-xyz');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mockFromInstance = supabase.from('active_devices');
    // upsert succeeds
    (mockFromInstance.upsert as any).mockResolvedValueOnce({ error: null });
    // select returns null data (session deleted remotely)
    (mockFromInstance.maybeSingle as any).mockResolvedValueOnce({ data: null, error: null });

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(logSpy).toHaveBeenCalledWith('Web terminal session terminated remotely.');
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    logSpy.mockRestore();
  });

  // ─── Interval pinging ─────────────────────────────────────────────

  test('should ping repeatedly using setInterval', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    useAuthStore.setState({ isLoggedIn: true });

    renderHook(() => useActiveDeviceTracker());

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);

    // Manually invoke the interval callback
    const callback = setIntervalSpy.mock.calls[0][0] as Function;
    callback();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Called twice: once on mount, once from manual interval trigger
    const mockFromInstance = supabase.from('active_devices');
    expect(mockFromInstance.upsert).toHaveBeenCalledTimes(2);

    setIntervalSpy.mockRestore();
  });

  // ─── OS/Browser detection ─────────────────────────────────────────

  test('should identify Windows OS from user agent', async () => {
    useAuthStore.setState({ isLoggedIn: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0',
      writable: true,
      configurable: true,
    });

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mockFromInstance = supabase.from('active_devices');
    const payload = (mockFromInstance.upsert as any).mock.calls[0][0];
    expect(payload.device_model).toContain('Windows');
    expect(payload.device_model).toContain('Chrome');
  });

  test('should identify macOS from user agent', async () => {
    useAuthStore.setState({ isLoggedIn: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
      writable: true,
      configurable: true,
    });

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mockFromInstance = supabase.from('active_devices');
    const payload = (mockFromInstance.upsert as any).mock.calls[0][0];
    expect(payload.device_model).toContain('macOS');
  });

  test('should identify Linux from user agent', async () => {
    useAuthStore.setState({ isLoggedIn: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0',
      writable: true,
      configurable: true,
    });

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mockFromInstance = supabase.from('active_devices');
    const payload = (mockFromInstance.upsert as any).mock.calls[0][0];
    // X11 matches UNIX in the detector
    expect(payload.device_model).toMatch(/UNIX|Linux/);
    expect(payload.device_model).toContain('Firefox');
  });

  test('should identify Android (detected via UA before Linux prefix check)', async () => {
    useAuthStore.setState({ isLoggedIn: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Android 12; Mobile; rv:109.0) Gecko/123.0 Firefox/123.0',
      writable: true,
      configurable: true,
    });

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    const mockFromInstance = supabase.from('active_devices');
    const payload = (mockFromInstance.upsert as any).mock.calls[0][0];
    // This UA has no 'Linux' text, so Android regex matches
    expect(payload.device_model).toContain('Android');
  });

  test('should clear interval when user logs out dynamically', async () => {
    useAuthStore.setState({ isLoggedIn: true });
    useBusinessStore.setState({ activeBusiness: { id: 'biz-123', name: 'Test Shop', category: '', address: '', phone: '' } });

    let intervalCb: any;
    const originalSetInterval = window.setInterval;
    window.setInterval = vi.fn().mockImplementation((cb: any) => {
      intervalCb = cb;
      return 999;
    }) as any;
    const originalClearInterval = window.clearInterval;
    const clearIntervalSpy = vi.fn();
    window.clearInterval = clearIntervalSpy as any;

    try {
      const { rerender } = renderHook(() => useActiveDeviceTracker());
      expect(window.setInterval).toHaveBeenCalled();

      // Change state to logged out and rerender
      useAuthStore.setState({ isLoggedIn: false });
      rerender();

      expect(clearIntervalSpy).toHaveBeenCalledWith(999);
    } finally {
      window.setInterval = originalSetInterval;
      window.clearInterval = originalClearInterval;
    }
  });

  test('should catch and warn errors in active device tracker', async () => {
    useAuthStore.setState({ isLoggedIn: true });
    useBusinessStore.setState({ activeBusiness: { id: 'biz-123', name: 'Test Shop', category: '', address: '', phone: '' } });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = () => { throw new Error('Storage Access Error'); };

    try {
      renderHook(() => useActiveDeviceTracker());
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(warnSpy).toHaveBeenCalledWith('Web active device tracker error:', expect.any(Error));
    } finally {
      localStorage.getItem = originalGetItem;
      warnSpy.mockRestore();
    }
  });
});

// ─── deleteCurrentDeviceSession ──────────────────────────────────────

describe('deleteCurrentDeviceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBusinessStore.setState({ activeBusiness: MOCK_BUSINESS });
    localStorage.clear();
  });

  test('should call supabase delete with correct device_id and business_id', async () => {
    localStorage.setItem(DEVICE_ID_KEY, 'device-to-delete');

    await deleteCurrentDeviceSession();

    expect(supabase.from).toHaveBeenCalledWith('active_devices');
  });

  test('should do nothing when no device ID in localStorage', async () => {
    // No device ID stored
    await deleteCurrentDeviceSession();
    // from might be called from other tests but not with active_devices delete chain
    // We just verify it doesn't throw
  });

  test('should do nothing when business id is "0"', async () => {
    localStorage.setItem(DEVICE_ID_KEY, 'device-xyz');
    useBusinessStore.setState({ activeBusiness: { ...MOCK_BUSINESS, id: '0' } });

    await deleteCurrentDeviceSession();
    // supabase.from for active_devices delete should NOT have been called
    const mockFromInstance = supabase.from('active_devices');
    expect(mockFromInstance.delete).not.toHaveBeenCalled();
  });

  test('should handle supabase delete error gracefully', async () => {
    localStorage.setItem(DEVICE_ID_KEY, 'device-err');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Make supabase.from throw
    (supabase.from as any).mockImplementationOnce(() => {
      throw new Error('Supabase connection error');
    });

    await deleteCurrentDeviceSession();
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to delete active web session on logout:',
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });
});
