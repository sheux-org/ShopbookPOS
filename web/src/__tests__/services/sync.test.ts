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

  // ─── syncDatabase ────────────────────────────────────────────────

  test('should skip sync if no active business ID is selected', async () => {
    const success = await syncDatabase();
    expect(success).toBe(false);
    expect(mockSynchronize).not.toHaveBeenCalled();
  });

  test('should log a warning when no active business ID exists', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await syncDatabase();
    expect(warnSpy).toHaveBeenCalledWith('Sync skipped: No active business ID selected.');
    warnSpy.mockRestore();
  });

  test('should execute synchronize pull and push changes successfully', async () => {
    useAuthStore.setState({ isLoggedIn: true, activeBusinessId: 'biz-test-uuid' });

    const mockPullRes = {
      changes: {
        businesses: { created: [{ id: 'b-1', name: 'Biz 1' }], updated: [], deleted: [] },
      },
      timestamp: 123456789,
    };

    const rpcMock = vi.fn().mockImplementation((fnName) => {
      if (fnName === 'pull_watermelondb_changes') {
        return Promise.resolve({ data: mockPullRes, error: null });
      }
      if (fnName === 'push_watermelondb_changes') {
        return Promise.resolve({ error: null });
      }
      return Promise.resolve({ error: null });
    });
    supabase.rpc = rpcMock;

    mockSynchronize.mockImplementationOnce(async (config: any) => {
      const pullResult = await config.pullChanges({ lastPulledAt: 0 });
      expect(pullResult.timestamp).toBe(123456789);
      expect(pullResult.changes.businesses.updated).toHaveLength(1);

      await config.pushChanges({
        changes: {
          businesses: { created: [{ id: 'b-1' }], updated: [], deleted: [] },
          products: { created: [], updated: [], deleted: [] },
        },
      });
    });

    const success = await syncDatabase();
    expect(success).toBe(true);
    expect(mockSynchronize).toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith('pull_watermelondb_changes', expect.any(Object));
    expect(rpcMock).toHaveBeenCalledWith('push_watermelondb_changes', expect.any(Object));
  });

  test('should return false and log error when synchronize throws', async () => {
    useAuthStore.setState({ isLoggedIn: true, activeBusinessId: 'biz-error-uuid' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockSynchronize.mockRejectedValueOnce(new Error('Sync failed'));

    const success = await syncDatabase();
    expect(success).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Failed to sync database:', expect.any(Error));
    errorSpy.mockRestore();
  });

  test('should return false and log error when pull changes returns an error', async () => {
    useAuthStore.setState({ isLoggedIn: true, activeBusinessId: 'biz-pull-err' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Simulate pull failing: synchronize throws because pullChanges rejects
    mockSynchronize.mockImplementationOnce(async (config: any) => {
      // pullChanges throws when RPC returns an error
      supabase.rpc = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Pull RPC failed' } });
      await config.pullChanges({ lastPulledAt: 0 }); // this throws 'Pull RPC failed'
    });

    const success = await syncDatabase();
    expect(success).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Failed to sync database:', expect.any(Error));
    errorSpy.mockRestore();
  });

  test('should return false and log error when push changes RPC returns an error', async () => {
    useAuthStore.setState({ isLoggedIn: true, activeBusinessId: 'biz-push-err' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockSynchronize.mockImplementationOnce(async (config: any) => {
      // Provide a valid pull response
      supabase.rpc = vi.fn().mockImplementation((fnName) => {
        if (fnName === 'pull_watermelondb_changes') {
          return Promise.resolve({
            data: {
              changes: { businesses: { created: [], updated: [], deleted: [] } },
              timestamp: 0,
            },
            error: null,
          });
        }
        // push RPC fails
        return Promise.resolve({ error: { message: 'Push RPC failed' } });
      });

      await config.pullChanges({ lastPulledAt: 0 });
      // This throws '"businesses: Push RPC failed"'
      await config.pushChanges({
        changes: {
          businesses: { created: [{ id: 'b1' }], updated: [], deleted: [] },
        },
      });
    });

    const success = await syncDatabase();
    expect(success).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Failed to sync database:', expect.any(Error));
    errorSpy.mockRestore();
  });

  test('should handle network/offline errors gracefully with console.warn instead of console.error', async () => {
    useAuthStore.setState({ isLoggedIn: true, activeBusinessId: 'biz-network-err' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockSynchronize.mockImplementationOnce(async (config: any) => {
      // Simulate fetch rejection due to network offline
      supabase.rpc = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      await config.pullChanges({ lastPulledAt: 0 });
    });

    const success = await syncDatabase();
    expect(success).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Sync failed due to network connectivity issues (offline mode).'
    );

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  // ─── uploadBusinessLogo ──────────────────────────────────────────

  test('should upload business logo file and return public url', async () => {
    const mockFile = new File(['mock-binary'], 'shop-logo.png', { type: 'image/png' });
    const publicUrl = await uploadBusinessLogo(mockFile, 'biz-123');

    expect(publicUrl).toBe('https://placeholder.logo');
    expect(supabase.storage.from).toHaveBeenCalledWith('business-logos');
  });

  test('should throw when supabase storage upload fails', async () => {
    const mockFile = new File(['data'], 'logo.jpg', { type: 'image/jpeg' });

    // Override the upload mock to return an error
    const mockStorageFrom = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: { message: 'Upload failed' } }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
    });
    (supabase.storage.from as any) = mockStorageFrom;

    await expect(uploadBusinessLogo(mockFile, 'biz-fail')).rejects.toEqual({
      message: 'Upload failed',
    });
  });
});
