import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useBusinessStore } from '../../stores/businessStore';
import { useAuthStore } from '../../stores/authStore';
import databaseMock, { mockCreate } from '../../db/__mocks__/database';

// Mock syncDatabase and supabase client
vi.mock('../../services/sync', () => ({
  syncDatabase: vi.fn().mockResolvedValue(true),
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock('../../db/database');

describe('businessStore', () => {
  // Stable per-table collections — rebuilt in beforeEach so each test gets fresh mocks
  // but within a single test, databaseMock.get('businesses') returns the SAME object.
  let collectionMap: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.persist.hasHydrated = () => true;
    localStorage.clear();

    // Build a stable map so tests can call databaseMock.get('businesses')
    // and the store receives the SAME mock object with any queued mockReturnValueOnce calls.
    collectionMap = {
      businesses: {
        query: vi.fn().mockReturnValue({ fetch: vi.fn().mockResolvedValue([]) }),
        create: vi.fn().mockImplementation(async (cb) => {
          const model: any = { id: 'new-biz-id', name: 'Test Biz' };
          if (cb) await cb(model);
          return model;
        }),
      },
      employees: {
        query: vi.fn().mockReturnValue({ fetch: vi.fn().mockResolvedValue([]) }),
        create: vi.fn().mockImplementation(async (cb) => {
          const model: any = { id: 'new-emp-id' };
          if (cb) {
            const bizSet = vi.fn();
            model.business = { set: bizSet };
            await cb(model);
          }
          return model;
        }),
      },
      products: {
        query: vi.fn().mockReturnValue({ fetch: vi.fn().mockResolvedValue([]) }),
        create: vi.fn().mockImplementation(async (cb) => {
          const model: any = {};
          if (cb) {
            const bizSet = vi.fn();
            model.business = { set: bizSet };
            await cb(model);
          }
          return model;
        }),
      },
      orders: {
        query: vi.fn().mockReturnValue({ fetch: vi.fn().mockResolvedValue([]) }),
        create: vi.fn().mockImplementation(async (cb) => {
          const model: any = {};
          if (cb) await cb(model);
          return model;
        }),
      },
    };

    // CRITICAL: vi.clearAllMocks() wipes mockImplementation. Restore database.write
    // so that it calls through its async callback, and database.get so it returns
    // stable per-table collection objects (same object per tableName per test).
    databaseMock.write.mockImplementation((cb: () => Promise<any>) => cb());
    databaseMock.get.mockImplementation(
      (tableName: string) =>
        collectionMap[tableName] || {
          query: vi.fn().mockReturnValue({ fetch: vi.fn().mockResolvedValue([]) }),
          create: vi.fn().mockImplementation(async (cb) => {
            const model: any = {};
            if (cb) await cb(model);
            return model;
          }),
        }
    );

    // Reset to default placeholder state
    useBusinessStore.setState({
      businesses: [
        {
          id: '0',
          name: 'Register Your Shop',
          category: 'General Retail',
          address: 'Complete onboarding setup',
          phone: '',
        },
      ],
      activeBusiness: {
        id: '0',
        name: 'Register Your Shop',
        category: 'General Retail',
        address: 'Complete onboarding setup',
        phone: '',
      },
    });
  });

  test('should initialize with default register shop placeholder', () => {
    const state = useBusinessStore.getState();
    expect(state.businesses).toHaveLength(1);
    expect(state.businesses[0].id).toBe('0');
    expect(state.activeBusiness.id).toBe('0');
  });

  // ─── setActiveBusiness ──────────────────────────────────────────

  test('should select active business branch when found', () => {
    const customBiz = {
      id: 'biz-123',
      name: 'Supermarket A',
      category: 'Grocery',
      address: 'Colombo',
      phone: '0771234567',
    };
    useBusinessStore.setState({ businesses: [customBiz], activeBusiness: customBiz });

    useBusinessStore.getState().setActiveBusiness('biz-123');
    expect(useBusinessStore.getState().activeBusiness.id).toBe('biz-123');
  });

  test('should do nothing when setActiveBusiness receives unknown id', () => {
    const existing = useBusinessStore.getState().activeBusiness;
    useBusinessStore.getState().setActiveBusiness('nonexistent-id');
    expect(useBusinessStore.getState().activeBusiness).toEqual(existing);
  });

  // ─── loadBusinessesFromDb ────────────────────────────────────────

  test('should skip load when auth store is not hydrated', async () => {
    useAuthStore.persist.hasHydrated = () => false;
    await useBusinessStore.getState().loadBusinessesFromDb();
    expect(databaseMock.get).not.toHaveBeenCalled();
  });

  test('should reset to placeholder when user is not logged in', async () => {
    // Not logged in, no phone
    useAuthStore.setState({ isLoggedIn: false, userPhone: null });
    await useBusinessStore.getState().loadBusinessesFromDb();
    expect(useBusinessStore.getState().businesses[0].id).toBe('0');
  });

  test('should load businesses matching logged-in phone number', async () => {
    useAuthStore.setState({ isLoggedIn: true, userPhone: '0771112222', activeBusinessId: null });

    // employees collection returns empty, businesses returns one match
    const employeeCollection = databaseMock.get('employees');
    employeeCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });

    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValueOnce({
      fetch: vi.fn().mockResolvedValue([
        {
          id: 'biz-loaded',
          name: 'Loaded Bakery',
          businessType: 'Bakery',
          address: 'Galle',
          phoneNumber: '0771112222',
        },
      ]),
    });

    await useBusinessStore.getState().loadBusinessesFromDb();

    const state = useBusinessStore.getState();
    expect(state.businesses[0].name).toBe('Loaded Bakery');
    expect(state.activeBusiness.id).toBe('biz-loaded');
  });

  test('should fall back to placeholder when no matching businesses found', async () => {
    useAuthStore.setState({ isLoggedIn: true, userPhone: '0779999999' });

    const employeeCollection = databaseMock.get('employees');
    employeeCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });

    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });

    await useBusinessStore.getState().loadBusinessesFromDb();

    expect(useBusinessStore.getState().activeBusiness.id).toBe('0');
  });

  // ─── registerBusiness ────────────────────────────────────────────

  test('should register a business and write to local DB', async () => {
    const mockBiz = { id: 'new-biz-id', name: 'My Bakery' };
    mockCreate.mockResolvedValueOnce(mockBiz);
    mockCreate.mockResolvedValueOnce({ id: 'emp-id' });

    useAuthStore.setState({ isLoggedIn: true, userPhone: '0771112222' });

    // businesses query returns empty for pre-check, then the bakery for loadBusinessesFromDb reload
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query
      .mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) })
      .mockReturnValue({
        fetch: vi.fn().mockResolvedValue([
          {
            id: 'new-biz-id',
            name: 'My Bakery',
            businessType: 'Bakery',
            address: 'Galle',
            phoneNumber: '0771112222',
          },
        ]),
      });

    const newId = await useBusinessStore
      .getState()
      .registerBusiness('My Bakery', 'Galle', '0771112222', 'Bakery');

    expect(newId).toBe('new-biz-id');
    expect(databaseMock.get).toHaveBeenCalledWith('businesses');
    expect(databaseMock.get).toHaveBeenCalledWith('employees');

    const state = useBusinessStore.getState();
    expect(state.activeBusiness.name).toBe('My Bakery');
  });

  test('should return undefined when registerBusiness throws an error', async () => {
    databaseMock.write.mockRejectedValueOnce(new Error('DB write error'));
    const result = await useBusinessStore.getState().registerBusiness('Shop X', 'Addr', 'Phone');
    expect(result).toBeUndefined();
  });

  // ─── updateActiveBusinessDetails ────────────────────────────────

  test('should update active business details in database', async () => {
    const activeBiz = {
      id: 'biz-active',
      name: 'Active Shop',
      category: 'Retail',
      address: 'Colombo',
      phone: '0771111111',
    };
    useBusinessStore.setState({ activeBusiness: activeBiz });
    useAuthStore.setState({ isLoggedIn: true, userPhone: '0771111111' });

    const targetBiz = {
      id: 'biz-active',
      update: vi.fn().mockImplementation(async (cb) => {
        const temp: any = {};
        await cb(temp);
      }),
    };

    // Override the businesses collection query to return our target biz
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    await useBusinessStore.getState().updateActiveBusinessDetails({
      name: 'Renamed Active Shop',
      category: 'General',
      address: 'Kandy',
      phone: '0771111111',
    });

    expect(targetBiz.update).toHaveBeenCalled();
  });

  test('should handle error in updateActiveBusinessDetails gracefully', async () => {
    const activeBiz = { id: 'biz-fail', name: 'Fail Shop', category: '', address: '', phone: '' };
    useBusinessStore.setState({ activeBusiness: activeBiz });

    const targetBiz = {
      id: 'biz-fail',
      update: vi.fn(),
    };
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    databaseMock.write.mockRejectedValueOnce(new Error('Update failure'));
    // Should not throw
    await expect(
      useBusinessStore
        .getState()
        .updateActiveBusinessDetails({ name: 'X', category: '', address: '', phone: '' })
    ).resolves.not.toThrow();
  });

  // ─── updateBusinessDetails ───────────────────────────────────────

  test('should update business details by id in database', async () => {
    const targetBiz = {
      id: 'biz-999',
      update: vi.fn().mockImplementation(async (cb) => {
        const temp: any = {};
        await cb(temp);
      }),
    };

    // Override businesses collection query to return target biz
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    await useBusinessStore.getState().updateBusinessDetails('biz-999', {
      name: 'Updated Shop Name',
      category: 'General Retail',
      address: 'Kandy',
      phone: '0773334444',
      logoUri: 'https://new-logo.png',
    });

    expect(databaseMock.get).toHaveBeenCalledWith('businesses');
    expect(targetBiz.update).toHaveBeenCalled();
  });

  test('should handle error in updateBusinessDetails gracefully', async () => {
    const targetBiz = {
      id: 'biz-err',
      update: vi.fn(),
    };
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    databaseMock.write.mockRejectedValueOnce(new Error('Update DB error'));
    await expect(
      useBusinessStore
        .getState()
        .updateBusinessDetails('biz-err', { name: 'X', category: '', address: '', phone: '' })
    ).resolves.not.toThrow();
  });

  // ─── deleteBusiness ──────────────────────────────────────────────

  test('should delete business and destroy record in local DB', async () => {
    const targetBiz = {
      id: 'biz-del',
      destroyPermanently: vi.fn().mockResolvedValue(undefined),
    };

    // Override businesses collection query to return target biz for deletion
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    await useBusinessStore.getState().deleteBusiness('biz-del');

    expect(databaseMock.get).toHaveBeenCalledWith('businesses');
    expect(targetBiz.destroyPermanently).toHaveBeenCalled();
  });

  test('should not delete the active business', async () => {
    const remaining = {
      id: 'biz-remaining',
      name: 'Second Shop',
      category: 'Grocery',
      address: 'Addr',
      phone: '000',
    };
    useBusinessStore.setState({
      activeBusiness: {
        id: 'biz-active-del',
        name: 'Soon Deleted',
        category: '',
        address: '',
        phone: '',
      },
      businesses: [
        { id: 'biz-active-del', name: 'Soon Deleted', category: '', address: '', phone: '' },
        remaining,
      ],
    });

    const destroyFn = vi.fn().mockResolvedValue(undefined);
    const targetBiz = { id: 'biz-active-del', destroyPermanently: destroyFn };

    // Override businesses collection to return target for deletion query
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    await useBusinessStore.getState().deleteBusiness('biz-active-del');

    expect(destroyFn).not.toHaveBeenCalled();
  });

  test('should handle error in deleteBusiness gracefully', async () => {
    const targetBiz = {
      id: 'biz-err',
      destroyPermanently: vi.fn(),
    };
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    databaseMock.write.mockRejectedValueOnce(new Error('Delete DB error'));
    await expect(useBusinessStore.getState().deleteBusiness('biz-err')).resolves.not.toThrow();
  });

  test('should delete inactive business and update businesses list', async () => {
    const bizActive = {
      id: 'biz-active',
      name: 'Active Shop',
      category: '',
      address: '',
      phone: '',
    };
    const bizInactive = {
      id: 'biz-deleted',
      name: 'Soon Deleted',
      category: 'Retail',
      address: 'Galle',
      phone: '0771',
    };

    useBusinessStore.setState({
      activeBusiness: bizActive,
      businesses: [bizActive, bizInactive],
    });
    useAuthStore.setState({ isLoggedIn: true, userPhone: '0771234567' });

    const destroyFn = vi.fn().mockResolvedValue(undefined);
    const targetBiz = { id: 'biz-deleted', destroyPermanently: destroyFn };

    const bizCol = databaseMock.get('businesses');
    // First query: find biz to delete
    bizCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });
    // After deletion: loadBusinessesFromDb reload → employees empty, businesses returns bizActive
    const empCol = databaseMock.get('employees');
    empCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });
    bizCol.query.mockReturnValueOnce({
      fetch: vi.fn().mockResolvedValue([
        {
          id: 'biz-active',
          name: 'Active Shop',
          businessType: 'Retail',
          address: 'Galle',
          phoneNumber: '0771234567',
        },
      ]),
    });

    await useBusinessStore.getState().deleteBusiness('biz-deleted');

    expect(destroyFn).toHaveBeenCalled();
    expect(useBusinessStore.getState().activeBusiness.id).toBe('biz-active');
  });

  // ─── loadBusinessesFromDb — employee-assigned businesses path ────

  test('should load businesses assigned to employee via relation fetch', async () => {
    useAuthStore.setState({ isLoggedIn: true, userPhone: '0771112233', activeBusinessId: null });

    const mockBizRecord = {
      id: 'emp-biz-1',
      name: 'Employee Assigned Shop',
      businessType: 'Bakery',
      address: 'Negombo',
      phoneNumber: '0779998888',
    };

    // employees query: returns an employee whose phone matches, with a business relation
    const empCol = databaseMock.get('employees');
    empCol.query.mockReturnValueOnce({
      fetch: vi.fn().mockResolvedValue([
        {
          phone: '0771112233',
          business: { fetch: vi.fn().mockResolvedValue(mockBizRecord) },
        },
      ]),
    });

    // businesses (owner) query: returns empty (not an owner)
    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });

    await useBusinessStore.getState().loadBusinessesFromDb();

    const state = useBusinessStore.getState();
    expect(state.businesses[0].name).toBe('Employee Assigned Shop');
    expect(state.activeBusiness.id).toBe('emp-biz-1');
  });

  test('should prefer activeBusinessId match when multiple businesses are loaded', async () => {
    useAuthStore.setState({
      isLoggedIn: true,
      userPhone: '0771112233',
      activeBusinessId: 'biz-preferred',
    });

    const empCol = databaseMock.get('employees');
    empCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });

    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValueOnce({
      fetch: vi.fn().mockResolvedValue([
        {
          id: 'biz-first',
          name: 'First Shop',
          businessType: 'Retail',
          address: 'Colombo',
          phoneNumber: '0771112233',
        },
        {
          id: 'biz-preferred',
          name: 'Preferred Shop',
          businessType: 'Grocery',
          address: 'Galle',
          phoneNumber: '0771112233',
        },
      ]),
    });

    await useBusinessStore.getState().loadBusinessesFromDb();

    expect(useBusinessStore.getState().activeBusiness.id).toBe('biz-preferred');
  });

  test('should handle loadBusinessesFromDb catch path gracefully', async () => {
    useAuthStore.setState({ isLoggedIn: true, userPhone: '0771112233' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Make database.get throw
    databaseMock.get.mockImplementationOnce(() => {
      throw new Error('DB unavailable');
    });

    await expect(useBusinessStore.getState().loadBusinessesFromDb()).resolves.not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to load businesses from IndexedDB:',
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });

  test('updateBusinessDetails should update logoUri when provided', async () => {
    const targetBiz = {
      id: 'biz-logo',
      update: vi.fn().mockImplementation(async (cb) => {
        const temp: any = {};
        await cb(temp);
        return temp;
      }),
    };

    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    await useBusinessStore.getState().updateBusinessDetails('biz-logo', {
      name: 'Logo Shop',
      category: 'Retail',
      address: 'Colombo',
      phone: '0771234567',
      logoUri: 'https://example.com/logo.png',
    });

    expect(targetBiz.update).toHaveBeenCalled();
  });

  test('updateBusinessDetails should skip logoUri update when undefined', async () => {
    const updatedFields: any = {};
    const targetBiz = {
      id: 'biz-no-logo',
      update: vi.fn().mockImplementation(async (cb) => {
        await cb(updatedFields);
      }),
    };

    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    await useBusinessStore.getState().updateBusinessDetails('biz-no-logo', {
      name: 'No Logo Shop',
      category: 'General',
      address: 'Kandy',
      phone: '0773334444',
      // logoUri intentionally omitted
    });

    // logoUri should NOT be set in the update callback
    expect(updatedFields.logoUri).toBeUndefined();
  });

  test('updateActiveBusinessDetails should update logoUri when provided', async () => {
    const activeBiz = {
      id: 'biz-active',
      name: 'Active Shop',
      category: 'Retail',
      address: 'Colombo',
      phone: '0771111111',
    };
    useBusinessStore.setState({ activeBusiness: activeBiz });

    const updatedFields: any = {};
    const targetBiz = {
      id: 'biz-active',
      update: vi.fn().mockImplementation(async (cb) => {
        await cb(updatedFields);
      }),
    };

    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    await useBusinessStore.getState().updateActiveBusinessDetails({
      name: 'Active Shop',
      category: 'Retail',
      address: 'Colombo',
      phone: '0771111111',
      logoUri: 'https://example.com/logo.png',
    });

    expect(updatedFields.logoUri).toBe('https://example.com/logo.png');
  });

  test('deleteBusiness should do nothing when deleting activeBusiness and load is skipped', async () => {
    const biz1 = { id: 'biz-deleted', name: 'Deleted', category: '', address: '', phone: '' };
    const biz2 = {
      id: 'biz-kept',
      name: 'Kept Shop',
      category: 'Retail',
      address: 'Galle',
      phone: '0771',
    };

    useBusinessStore.setState({
      activeBusiness: biz1,
      businesses: [biz1, biz2],
    });
    // Skip DB load
    useAuthStore.persist.hasHydrated = () => false;

    const destroyFn = vi.fn().mockResolvedValue(undefined);
    const targetBiz = { id: 'biz-deleted', destroyPermanently: destroyFn };

    await useBusinessStore.getState().deleteBusiness('biz-deleted');

    expect(destroyFn).not.toHaveBeenCalled();
    expect(useBusinessStore.getState().activeBusiness.id).toBe('biz-deleted');
  });

  test('deleteBusiness should do nothing when business is not found', async () => {
    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });

    await useBusinessStore.getState().deleteBusiness('non-existent');
  });

  test('deleteBusiness should not set activeBusiness if no businesses remain', async () => {
    const biz1 = { id: 'biz-deleted', name: 'Deleted', category: '', address: '', phone: '' };

    useBusinessStore.setState({
      activeBusiness: biz1,
      businesses: [biz1],
    });
    // Skip DB load
    useAuthStore.persist.hasHydrated = () => false;

    const destroyFn = vi.fn().mockResolvedValue(undefined);
    const targetBiz = { id: 'biz-deleted', destroyPermanently: destroyFn };

    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([targetBiz]) });

    // Empty out businesses in state to simulate remaining.length === 0
    useBusinessStore.setState({ businesses: [] });

    await useBusinessStore.getState().deleteBusiness('biz-deleted');

    expect(destroyFn).not.toHaveBeenCalled();
    expect(useBusinessStore.getState().activeBusiness.id).toBe('biz-deleted');
  });

  test('should support SSR environments where window is undefined', async () => {
    vi.resetModules();
    const originalWindow = global.window;

    Object.defineProperty(global, 'window', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { useBusinessStore: ssrStore } = await import('../../stores/businessStore');
    expect(ssrStore).toBeDefined();

    // Restore window
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  test('registerBusiness should skip seeding if multiple businesses already exist', async () => {
    useAuthStore.setState({ isLoggedIn: true, userPhone: '0771112222' });

    // businesses query returns two existing businesses
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValue({
      fetch: vi.fn().mockResolvedValue([{ id: 'biz-1' }, { id: 'biz-2' }]),
    });

    const newId = await useBusinessStore
      .getState()
      .registerBusiness('Skip Seed Store', 'Colombo', '0771112222');
    expect(newId).toBeDefined();
    expect(databaseMock.write).toHaveBeenCalledTimes(1);
  });

  test('registerBusiness should skip seeding if products already exist in db', async () => {
    useAuthStore.setState({ isLoggedIn: true, userPhone: '0771112222' });

    // businesses query returns 1 business
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValueOnce({
      fetch: vi.fn().mockResolvedValue([{ id: 'biz-1' }]),
    });
    // products query returns an existing product list
    const prodCollection = databaseMock.get('products');
    prodCollection.query.mockReturnValueOnce({
      fetch: vi.fn().mockResolvedValue([{ id: 'prod-1' }]),
    });

    await useBusinessStore
      .getState()
      .registerBusiness('Skip Seed Store 2', 'Colombo', '0771112222');
    expect(databaseMock.write).toHaveBeenCalledTimes(1);
  });

  test('registerBusiness should return undefined when newBusinessRecord is not created', async () => {
    useAuthStore.setState({ isLoggedIn: true, userPhone: '0771112222' });

    // Mock create to return undefined
    const bizCol = databaseMock.get('businesses');
    bizCol.create.mockResolvedValueOnce(undefined);

    const result = await useBusinessStore.getState().registerBusiness('Fail Biz', 'Addr', '0771');
    expect(result).toBeUndefined();
  });

  test('updateActiveBusinessDetails should return early when active business is not found', async () => {
    const activeBiz = {
      id: 'biz-none',
      name: 'Active Shop',
      category: 'Retail',
      address: 'Colombo',
      phone: '0771111111',
    };
    useBusinessStore.setState({ activeBusiness: activeBiz });

    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });

    await useBusinessStore.getState().updateActiveBusinessDetails({
      name: 'X',
      category: '',
      address: '',
      phone: '',
    });
    expect(databaseMock.write).not.toHaveBeenCalled();
  });

  test('updateBusinessDetails should return early when business is not found', async () => {
    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });

    await useBusinessStore.getState().updateBusinessDetails('biz-none', {
      name: 'X',
      category: '',
      address: '',
      phone: '',
    });
    expect(databaseMock.write).not.toHaveBeenCalled();
  });

  test('loadBusinessesFromDb should do nothing when user is logged in but has no phone', async () => {
    useAuthStore.setState({ isLoggedIn: true, userPhone: null });

    const originalBusinesses = useBusinessStore.getState().businesses;

    await useBusinessStore.getState().loadBusinessesFromDb();

    expect(useBusinessStore.getState().businesses).toEqual(originalBusinesses);
  });
});
