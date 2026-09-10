import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useEntitlementStore } from '../../stores/useEntitlementStore';
import { supabase } from '../../services/supabaseClient';

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('useEntitlementStore (Web)', () => {
  beforeEach(() => {
    localStorage.clear();
    useEntitlementStore.getState().reset();
    vi.clearAllMocks();
  });

  test('should initialize with default locked / fail-closed state', () => {
    const state = useEntitlementStore.getState();
    expect(state.isPro).toBe(false);
    expect(state.isTrial).toBe(false);
    expect(state.hasCheckedServer).toBe(false);
    expect(state.cachedBusinessId).toBeNull();
  });

  test('should return BLOCKED status when no business is selected', () => {
    expect(useEntitlementStore.getState().getStatus(null)).toBe('BLOCKED');
    expect(useEntitlementStore.getState().getStatus('0')).toBe('BLOCKED');
  });

  test('should return INITIALIZING status before server check finishes for a business', () => {
    expect(useEntitlementStore.getState().getStatus('biz-100')).toBe('INITIALIZING');
  });

  test('should update to VERIFIED_PRO when server confirms Pro status', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        is_pro: true,
        is_trial: false,
        is_owner: true,
        expires_at: futureDate,
      },
      error: null,
    } as any);

    await useEntitlementStore.getState().refresh('biz-100');

    const state = useEntitlementStore.getState();
    expect(state.isPro).toBe(true);
    expect(state.hasCheckedServer).toBe(true);
    expect(state.cachedBusinessId).toBe('biz-100');
    expect(state.getStatus('biz-100')).toBe('VERIFIED_PRO');
  });

  test('should update to BLOCKED when server confirms non-Pro status', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        is_pro: false,
        is_trial: false,
        is_owner: false,
        expires_at: null,
      },
      error: null,
    } as any);

    await useEntitlementStore.getState().refresh('biz-nonpro');

    const state = useEntitlementStore.getState();
    expect(state.isPro).toBe(false);
    expect(state.hasCheckedServer).toBe(true);
    expect(state.getStatus('biz-nonpro')).toBe('BLOCKED');
  });

  test('should return NETWORK_ERROR if RPC fails and no valid cache exists', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'Network offline' },
    } as any);

    await useEntitlementStore.getState().refresh('biz-offline');

    const state = useEntitlementStore.getState();
    expect(state.isPro).toBe(false);
    expect(state.lastError).toBe('Network offline');
    expect(state.getStatus('biz-offline')).toBe('NETWORK_ERROR');
  });

  test('should reset cache when switching to another business to prevent entitlement leakage', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { is_pro: true, expires_at: futureDate },
      error: null,
    } as any);

    await useEntitlementStore.getState().refresh('biz-pro');
    expect(useEntitlementStore.getState().getStatus('biz-pro')).toBe('VERIFIED_PRO');

    // Switching to biz-other before server replies should immediately NOT be VERIFIED_PRO
    vi.mocked(supabase.rpc).mockReturnValue(new Promise(() => {}) as any); // pending
    void useEntitlementStore.getState().refresh('biz-other');

    expect(useEntitlementStore.getState().getStatus('biz-other')).toBe('INITIALIZING');
    expect(useEntitlementStore.getState().isPro).toBe(false);
  });
});
