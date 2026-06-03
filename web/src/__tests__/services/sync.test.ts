import { describe, test, expect, vi, beforeEach } from 'vitest';
import { syncDatabase, uploadBusinessLogo, supabase } from '../../services/sync';
import { useAuthStore } from '../../stores/authStore';

// 1. Mock watermelondb sync module
const mockSynchronize = vi.fn();
vi.mock('@nozbe/watermelondb/sync', () => ({
  synchronize: (config: any) => mockSynchronize(config),
}));

describe('Supabase Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
  });

  test('should skip sync if no active business ID is selected', async () => {
    const success = await syncDatabase();
    expect(success).toBe(false);
    expect(mockSynchronize).not.toHaveBeenCalled();
  });

  test('should execute synchronize pull and push changes successfully', async () => {
    // 1. Simulate login to enable active business sync
    useAuthStore.setState({
      isLoggedIn: true,
      activeBusinessId: 'biz-test-uuid',
    });

    // 2. Mock database collection changes to call push/pull
    const mockPullRes = {
      changes: {
        businesses: { created: [{ id: 'b-1', name: 'Biz 1' }], updated: [], deleted: [] }
      },
      timestamp: 123456789
    };
    
    // Mock Supabase RPC callbacks
    const rpcMock = vi.fn().mockImplementation((fnName, params) => {
      if (fnName === 'pull_watermelondb_changes') {
        return Promise.resolve({ data: mockPullRes, error: null });
      }
      if (fnName === 'push_watermelondb_changes') {
        return Promise.resolve({ error: null });
      }
      return Promise.resolve({ error: null });
    });
    supabase.rpc = rpcMock;

    mockSynchronize.mockImplementationOnce(async (config) => {
      // Execute the pullChanges callback
      const pullResult = await config.pullChanges({ lastPulledAt: 0 });
      expect(pullResult.timestamp).toBe(123456789);
      expect(pullResult.changes.businesses.created).toHaveLength(1);

      // Execute the pushChanges callback
      await config.pushChanges({
        changes: {
          businesses: { created: [{ id: 'b-1' }], updated: [], deleted: [] },
          products: { created: [], updated: [], deleted: [] },
        }
      });
      return Promise.resolve();
    });

    // 3. Trigger sync
    const success = await syncDatabase();
    expect(success).toBe(true);
    expect(mockSynchronize).toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith('pull_watermelondb_changes', expect.any(Object));
    expect(rpcMock).toHaveBeenCalledWith('push_watermelondb_changes', expect.any(Object));
  });

  test('should upload business logo file and return public url', async () => {
    const mockFile = new File(['mock-binary'], 'shop-logo.png', { type: 'image/png' });
    const publicUrl = await uploadBusinessLogo(mockFile, 'biz-123');

    expect(publicUrl).toBe('https://placeholder.logo');
    expect(supabase.storage.from).toHaveBeenCalledWith('business-logos');
  });
});
