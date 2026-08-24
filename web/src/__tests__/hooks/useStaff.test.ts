import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCreateStaff, useUpdateStaff, useDeleteStaff, useStaff } from '../../hooks/useStaff';
import databaseMock from '../../db/__mocks__/database';

vi.mock('../../db/database');
vi.mock('../../services/sync', () => ({
  syncDatabase: vi.fn().mockResolvedValue(true),
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('useStaff Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('useStaff should fetch employees for active business', async () => {
    const mockEmployees = [
      {
        id: 'emp-1',
        name: 'Kasun Silva',
        role: 'admin',
        phone: '0771112233',
        email: 'kasun@shopbook.lk',
      },
    ];

    const empCol = databaseMock.get('employees');
    empCol.query.mockReturnValue({
      fetch: vi.fn().mockResolvedValue(mockEmployees),
    });

    const { result } = renderHook(() => useStaff('biz-123'));

    let queryRes: any;
    await act(async () => {
      queryRes = await result.current.refetch();
    });

    expect(queryRes.data).toHaveLength(1);
    expect(queryRes.data?.[0].name).toBe('Kasun Silva');
    expect(queryRes.data?.[0].role).toBe('Admin');
  });

  test('useCreateStaff should create staff with markAsDeleted-ready model and trigger sync', async () => {
    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValue({
      fetch: vi.fn().mockResolvedValue([{ id: 'biz-123', name: 'My Shop' }]),
    });

    const empCol = databaseMock.get('employees');
    empCol.query.mockReturnValue({
      fetch: vi.fn().mockResolvedValue([]),
    });

    const { result } = renderHook(() => useCreateStaff('biz-123'));

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Dilshan',
        role: 'Cashier',
        phone: '0779998811',
        email: 'dilshan@shopbook.lk',
      });
    });

    expect(databaseMock.write).toHaveBeenCalled();
  });

  test('useCreateStaff should reject duplicate phone number', async () => {
    const empCol = databaseMock.get('employees');
    empCol.query.mockReturnValue({
      fetch: vi
        .fn()
        .mockResolvedValue([{ id: 'emp-existing', name: 'Already Here', phone: '0779998811' }]),
    });

    const { result } = renderHook(() => useCreateStaff('biz-123'));

    await expect(
      result.current.mutateAsync({
        name: 'New Duplicate',
        role: 'Cashier',
        phone: '0779998811',
      })
    ).rejects.toThrow('This phone number is already registered.');
  });

  test('useDeleteStaff should call markAsDeleted instead of destroyPermanently', async () => {
    const markAsDeletedMock = vi.fn().mockResolvedValue(undefined);
    const mockEmp = {
      id: 'emp-target',
      name: 'Regular Cashier',
      phone: '0773334455',
      markAsDeleted: markAsDeletedMock,
    };

    const empCol = databaseMock.get('employees');
    empCol.query.mockReturnValue({
      fetch: vi.fn().mockResolvedValue([mockEmp]),
    });

    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValue({
      fetch: vi.fn().mockResolvedValue([{ id: 'biz-123', phoneNumber: '0770000000' }]),
    });

    const { result } = renderHook(() => useDeleteStaff('biz-123'));

    await act(async () => {
      await result.current.mutateAsync('emp-target');
    });

    expect(markAsDeletedMock).toHaveBeenCalled();
  });

  test('useDeleteStaff should prevent deleting Owner / Admin', async () => {
    const mockOwner = {
      id: 'emp-owner',
      name: 'Owner / Admin',
      phone: '0770000000',
    };

    const empCol = databaseMock.get('employees');
    empCol.query.mockReturnValue({
      fetch: vi.fn().mockResolvedValue([mockOwner]),
    });

    const bizCol = databaseMock.get('businesses');
    bizCol.query.mockReturnValue({
      fetch: vi.fn().mockResolvedValue([{ id: 'biz-123', phoneNumber: '0770000000' }]),
    });

    const { result } = renderHook(() => useDeleteStaff('biz-123'));

    await expect(result.current.mutateAsync('emp-owner')).rejects.toThrow(
      'Owner / Admin cannot be deleted.'
    );
  });
});
