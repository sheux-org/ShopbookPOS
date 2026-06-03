import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActiveDeviceTracker, DEVICE_ID_KEY } from '../../hooks/useActiveDeviceTracker';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { supabase } from '../../services/sync';

describe('useActiveDeviceTracker Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useBusinessStore.setState({
      activeBusiness: {
        id: 'biz-123',
        name: 'My Store',
        category: 'Grocery',
        address: 'Colombo',
        phone: '0771112222',
      },
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should not ping if user is not logged in', () => {
    renderHook(() => useActiveDeviceTracker());

    // Supabase active_devices upsert should NOT be called
    expect(supabase.from).not.toHaveBeenCalledWith('active_devices');
  });

  test('should ping and register terminal status when logged in', async () => {
    // 1. Simulate logged in state
    useAuthStore.setState({
      isLoggedIn: true,
      activeEmployeeId: 'emp-cashier',
      employeeName: 'Kamal Gunaratne',
      userRole: 'cashier',
    });

    // Mock device ID in localStorage
    localStorage.setItem(DEVICE_ID_KEY, 'device-uuid-123');

    // 2. Render tracker hook
    renderHook(() => useActiveDeviceTracker());

    // Allow async microtasks for navigator.getBattery and geolocation promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 3. Verify upsert payload properties
    expect(supabase.from).toHaveBeenCalledWith('active_devices');
    const mockFromInstance = supabase.from('active_devices');
    expect(mockFromInstance.upsert).toHaveBeenCalled();

    const payload = (mockFromInstance.upsert as any).mock.calls[0][0];
    expect(payload.device_id).toBe('device-uuid-123');
    expect(payload.business_id).toBe('biz-123');
    expect(payload.employee_id).toBe('emp-cashier');
    expect(payload.employee_name).toBe('Kamal Gunaratne');
    expect(payload.role).toBe('cashier');
    expect(payload.battery_level).toBe(85); // Matches navigator.getBattery mock in setup.ts
    expect(payload.latitude).toBe(6.9271); // Matches geolocation mock in setup.ts
    expect(payload.longitude).toBe(79.8612);
  });

  test('should handle geolocation permission denied error', async () => {
    useAuthStore.setState({
      isLoggedIn: true,
      activeEmployeeId: 'emp-cashier',
      employeeName: 'Kamal Gunaratne',
      userRole: 'cashier',
    });

    // Mock geolocation to reject with PERMISSION_DENIED (code 1)
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn().mockImplementation((success, error) =>
          error({
            code: 1, // PERMISSION_DENIED
            message: 'Permission denied',
          })
        ),
      },
      writable: true,
      configurable: true,
    });

    renderHook(() => useActiveDeviceTracker());

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify it saved 'Location Denied' in the location name
    const mockFromInstance = supabase.from('active_devices');
    const payload = (mockFromInstance.upsert as any).mock.calls[0][0];
    expect(payload.location_name).toBe('Location Denied');
  });

  test('should print warning when database upsert fails', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useAuthStore.setState({ isLoggedIn: true });
    
    // Mock upsert error return
    const mockFromInstance = supabase.from('active_devices');
    (mockFromInstance.upsert as any).mockResolvedValueOnce({ error: { message: 'Network Timeout' } });

    renderHook(() => useActiveDeviceTracker());

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to upsert active device status:', { message: 'Network Timeout' });
    consoleWarnSpy.mockRestore();
  });

  test('should ping repeatedly using intervals', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    useAuthStore.setState({ isLoggedIn: true });
    
    renderHook(() => useActiveDeviceTracker());

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    const callback = setIntervalSpy.mock.calls[0][0] as Function;

    // Trigger the interval callback manually
    callback();
    
    // Allow async microtasks in the manual callback runTracker to finish
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should have upserted twice (once on mount, once on manual interval trigger)
    const mockFromInstance = supabase.from('active_devices');
    expect(mockFromInstance.upsert).toHaveBeenCalledTimes(2);

    setIntervalSpy.mockRestore();
  });
});
