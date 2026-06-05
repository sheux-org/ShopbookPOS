import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useActiveDeviceTracker,
  DEVICE_ID_KEY,
  deleteCurrentDeviceSession,
} from '../../hooks/useActiveDeviceTracker';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import * as devicePresence from '../../services/devicePresence';

vi.mock('../../services/devicePresence', () => ({
  startDevicePresenceTracking: vi.fn().mockResolvedValue(undefined),
  trackPresenceState: vi.fn().mockResolvedValue(undefined),
  teardownDevicePresence: vi.fn().mockResolvedValue(undefined),
  deleteOfflineSnapshot: vi.fn().mockResolvedValue(undefined),
}));

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
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should not start presence tracking if user is not logged in', () => {
    renderHook(() => useActiveDeviceTracker());
    expect(devicePresence.startDevicePresenceTracking).not.toHaveBeenCalled();
  });

  test('should not start presence tracking when activeBusinessId is "0"', () => {
    useAuthStore.setState({ isLoggedIn: true });
    useBusinessStore.setState({
      activeBusiness: { ...MOCK_BUSINESS, id: '0' },
    });

    renderHook(() => useActiveDeviceTracker());
    expect(devicePresence.startDevicePresenceTracking).not.toHaveBeenCalled();
  });

  test('should start presence tracking when logged in', async () => {
    useAuthStore.setState({
      isLoggedIn: true,
      activeEmployeeId: 'emp-cashier',
      employeeName: 'Kamal Gunaratne',
      userRole: 'cashier',
    });
    localStorage.setItem(DEVICE_ID_KEY, 'device-uuid-123');

    renderHook(() => useActiveDeviceTracker());

    await waitFor(() => {
      expect(devicePresence.startDevicePresenceTracking).toHaveBeenCalled();
    });

    const [, deviceId, state] = vi.mocked(devicePresence.startDevicePresenceTracking).mock.calls[0];
    expect(deviceId).toBe('device-uuid-123');
    expect(state.device_id).toBe('device-uuid-123');
    expect(state.business_id).toBe('biz-123');
    expect(state.employee_id).toBe('emp-cashier');
    expect(state.employee_name).toBe('Kamal Gunaratne');
    expect(state.role).toBe('cashier');
    expect(state.platform).toBe('web');
    expect(state.battery_level).toBe(85);
    expect(state.latitude).toBe(6.9271);
    expect(state.longitude).toBe(79.8612);
  });

  test('should auto-generate and store a device ID if none exists', async () => {
    useAuthStore.setState({ isLoggedIn: true });

    renderHook(() => useActiveDeviceTracker());
    await waitFor(() => {
      expect(devicePresence.startDevicePresenceTracking).toHaveBeenCalled();
    });

    const storedId = localStorage.getItem(DEVICE_ID_KEY);
    expect(storedId).not.toBeNull();
    expect(storedId).toMatch(/[0-9a-f-]{36}/);
  });

  test('should skip presence when navigator is offline', async () => {
    useAuthStore.setState({ isLoggedIn: true });
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    renderHook(() => useActiveDeviceTracker());
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(logSpy).toHaveBeenCalledWith('Client is offline, skipping presence update.');
    expect(devicePresence.startDevicePresenceTracking).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  test('should handle geolocation permission denied error', async () => {
    useAuthStore.setState({ isLoggedIn: true });

    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi
          .fn()
          .mockImplementation((_success, error) =>
            error({ code: 1, message: 'Permission denied' })
          ),
      },
      writable: true,
      configurable: true,
    });

    renderHook(() => useActiveDeviceTracker());
    await waitFor(() => {
      expect(devicePresence.startDevicePresenceTracking).toHaveBeenCalled();
    });

    const state = vi.mocked(devicePresence.startDevicePresenceTracking).mock.calls[0][2];
    expect(state.location_name).toBe('Location Denied');
  });

  test('should set location_name to "Geolocation Unsupported" when geolocation is absent', async () => {
    useAuthStore.setState({ isLoggedIn: true });

    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    renderHook(() => useActiveDeviceTracker());
    await waitFor(() => {
      expect(devicePresence.startDevicePresenceTracking).toHaveBeenCalled();
    });

    const state = vi.mocked(devicePresence.startDevicePresenceTracking).mock.calls[0][2];
    expect(state.location_name).toBe('Geolocation Unsupported');
  });

  test('should logout when remote session revoke callback fires', async () => {
    useAuthStore.setState({ isLoggedIn: true, activeEmployeeId: 'emp-1' });
    localStorage.setItem(DEVICE_ID_KEY, 'device-xyz');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    renderHook(() => useActiveDeviceTracker());
    await waitFor(() => {
      expect(devicePresence.startDevicePresenceTracking).toHaveBeenCalled();
    });

    const revokeHandler = vi.mocked(devicePresence.startDevicePresenceTracking).mock.calls[0][3];
    revokeHandler?.('device-xyz');

    expect(logSpy).toHaveBeenCalledWith('Web terminal session terminated remotely.');
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    logSpy.mockRestore();
  });

  test('should logout when device was previously revoked', async () => {
    useAuthStore.setState({ isLoggedIn: true });
    vi.mocked(devicePresence.startDevicePresenceTracking).mockRejectedValueOnce(
      new Error('DEVICE_REVOKED')
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    renderHook(() => useActiveDeviceTracker());
    await waitFor(() => {
      expect(useAuthStore.getState().isLoggedIn).toBe(false);
    });

    expect(logSpy).toHaveBeenCalledWith('Web device session was previously revoked.');
    logSpy.mockRestore();
  });

  test('should identify Windows OS from user agent', async () => {
    useAuthStore.setState({ isLoggedIn: true });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0',
      writable: true,
      configurable: true,
    });

    renderHook(() => useActiveDeviceTracker());
    await waitFor(() => {
      expect(devicePresence.startDevicePresenceTracking).toHaveBeenCalled();
    });

    const state = vi.mocked(devicePresence.startDevicePresenceTracking).mock.calls[0][2];
    expect(state.device_model).toContain('Windows');
    expect(state.device_model).toContain('Chrome');
  });

  test('should teardown presence when user logs out dynamically', async () => {
    useAuthStore.setState({ isLoggedIn: true });

    const { rerender } = renderHook(() => useActiveDeviceTracker());
    await waitFor(() => {
      expect(devicePresence.startDevicePresenceTracking).toHaveBeenCalled();
    });

    useAuthStore.setState({ isLoggedIn: false });
    rerender();

    await waitFor(() => {
      expect(devicePresence.teardownDevicePresence).toHaveBeenCalled();
    });
  });

  test('should catch and warn errors in active device tracker', async () => {
    useAuthStore.setState({ isLoggedIn: true });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = () => {
      throw new Error('Storage Access Error');
    };

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

describe('deleteCurrentDeviceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBusinessStore.setState({ activeBusiness: MOCK_BUSINESS });
    localStorage.clear();
  });

  test('should teardown presence and delete offline snapshot', async () => {
    localStorage.setItem(DEVICE_ID_KEY, 'device-to-delete');

    await deleteCurrentDeviceSession();

    expect(devicePresence.teardownDevicePresence).toHaveBeenCalledWith({ writeSnapshot: false });
    expect(devicePresence.deleteOfflineSnapshot).toHaveBeenCalledWith(
      'biz-123',
      'device-to-delete'
    );
  });

  test('should do nothing when no device ID in localStorage', async () => {
    await deleteCurrentDeviceSession();
  });

  test('should do nothing when business id is "0"', async () => {
    localStorage.setItem(DEVICE_ID_KEY, 'device-xyz');
    useBusinessStore.setState({ activeBusiness: { ...MOCK_BUSINESS, id: '0' } });

    await deleteCurrentDeviceSession();
    expect(devicePresence.teardownDevicePresence).not.toHaveBeenCalled();
  });

  test('should handle cleanup error gracefully', async () => {
    localStorage.setItem(DEVICE_ID_KEY, 'device-err');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(devicePresence.teardownDevicePresence).mockRejectedValueOnce(
      new Error('Supabase connection error')
    );

    await deleteCurrentDeviceSession();
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to delete active web session on logout:',
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });
});
