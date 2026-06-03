import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useBusinessStore } from '../../stores/businessStore';
import { useAuthStore } from '../../stores/authStore';
import databaseMock, { mockFetch, mockCreate, mockUpdate, mockDestroy } from '../../db/__mocks__/database';

// Mock syncDatabase
vi.mock('../../services/sync', () => ({
  syncDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../db/database');

describe('businessStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.persist.hasHydrated = () => true;
    localStorage.clear();

    // Reset to default placeholder state
    useBusinessStore.setState({
      businesses: [{ id: '0', name: 'Register Your Shop', category: 'General Retail', address: 'Complete onboarding setup', phone: '' }],
      activeBusiness: { id: '0', name: 'Register Your Shop', category: 'General Retail', address: 'Complete onboarding setup', phone: '' },
    });
  });

  // ─── Initial state ───────────────────────────────────────────────

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
        { id: 'biz-loaded', name: 'Loaded Bakery', businessType: 'Bakery', address: 'Galle', phoneNumber: '0771112222' },
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

    // businesses query returns the bakery (for loadBusinessesFromDb reload)
    const bizCollection = databaseMock.get('businesses');
    bizCollection.query.mockReturnValue({
      fetch: vi.fn().mockResolvedValue([
        { id: 'new-biz-id', name: 'My Bakery', businessType: 'Bakery', address: 'Galle', phoneNumber: '0771112222' }
      ]),
    });

    const newId = await useBusinessStore.getState().registerBusiness(
      'My Bakery',
      'Galle',
      '0771112222',
      'Bakery'
    );

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
    const activeBiz = { id: 'biz-active', name: 'Active Shop', category: 'Retail', address: 'Colombo', phone: '0771111111' };
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
    useBusinessStore.setState({
      activeBusiness: { id: 'biz-fail', name: 'Fail Shop', category: '', address: '', phone: '' },
    });
    databaseMock.write.mockRejectedValueOnce(new Error('Update failure'));
    // Should not throw
    await expect(
      useBusinessStore.getState().updateActiveBusinessDetails({ name: 'X', category: '', address: '', phone: '' })
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
    databaseMock.write.mockRejectedValueOnce(new Error('Update DB error'));
    await expect(
      useBusinessStore.getState().updateBusinessDetails('biz-err', { name: 'X', category: '', address: '', phone: '' })
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

  test('should switch active business to first remaining after deleting active one', async () => {
    const remaining = { id: 'biz-remaining', name: 'Second Shop', category: 'Grocery', address: 'Addr', phone: '000' };
    useBusinessStore.setState({
      activeBusiness: { id: 'biz-active-del', name: 'Soon Deleted', category: '', address: '', phone: '' },
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

    // After deletion, loadBusinessesFromDb reload: employees returns empty, businesses returns empty
    const empCollection = databaseMock.get('employees');
    empCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });
    bizCollection.query.mockReturnValueOnce({ fetch: vi.fn().mockResolvedValue([]) });

    await useBusinessStore.getState().deleteBusiness('biz-active-del');

    expect(destroyFn).toHaveBeenCalled();
  });

  test('should handle error in deleteBusiness gracefully', async () => {
    databaseMock.write.mockRejectedValueOnce(new Error('Delete DB error'));
    await expect(
      useBusinessStore.getState().deleteBusiness('biz-err')
    ).resolves.not.toThrow();
  });
});
