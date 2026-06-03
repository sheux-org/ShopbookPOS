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
  });

  test('should initialize with default register shop placeholder', () => {
    const state = useBusinessStore.getState();
    expect(state.businesses).toHaveLength(1);
    expect(state.businesses[0].id).toBe('0');
    expect(state.activeBusiness.id).toBe('0');
  });

  test('should select active business branch', () => {
    const customBiz = {
      id: 'biz-123',
      name: 'Supermarket A',
      category: 'Grocery',
      address: 'Colombo',
      phone: '0771234567',
    };
    
    // Manually set business state for selection test
    useBusinessStore.setState({
      businesses: [customBiz],
      activeBusiness: customBiz,
    });

    useBusinessStore.getState().setActiveBusiness('biz-123');
    expect(useBusinessStore.getState().activeBusiness.id).toBe('biz-123');
  });

  test('should register a business and write to local DB', async () => {
    const mockBiz = { id: 'new-biz-id', name: 'My Bakery' };
    mockCreate.mockResolvedValueOnce(mockBiz); // first create for business
    mockCreate.mockResolvedValueOnce({ id: 'emp-id' }); // second create for employee

    // Mock query fetches for reload function triggered in registration
    mockFetch.mockResolvedValue([
      {
        id: 'new-biz-id',
        name: 'My Bakery',
        businessType: 'Bakery',
        address: 'Galle',
        phoneNumber: '0771112222',
      }
    ]); // business query returns the bakery


    // Simulate logged-in owner state so reload query runs
    useAuthStore.setState({
      isLoggedIn: true,
      userPhone: '0771112222',
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

  test('should update business details in database', async () => {
    const targetBiz = {
      id: 'biz-999',
      update: vi.fn().mockImplementation((cb) => {
        const temp = { name: '', businessType: '', address: '', phoneNumber: '', logoUri: '' };
        cb(temp);
      }),
    };
    mockFetch.mockResolvedValueOnce([targetBiz]);

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

  test('should delete business and destroy record in local DB', async () => {
    const targetBiz = {
      id: 'biz-del',
      destroyPermanently: mockDestroy,
    };
    mockFetch.mockResolvedValueOnce([targetBiz]);

    await useBusinessStore.getState().deleteBusiness('biz-del');

    expect(databaseMock.get).toHaveBeenCalledWith('businesses');
    expect(mockDestroy).toHaveBeenCalled();
  });
});
