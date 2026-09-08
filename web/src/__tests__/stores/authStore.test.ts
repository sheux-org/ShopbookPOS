import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../../stores/authStore';
import type { Session, User } from '@supabase/supabase-js';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  test('should initialize with default logged-out state', () => {
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.userPhone).toBeNull();
    expect(state.userRole).toBe('admin');
    expect(state.activeBusinessId).toBeNull();
    expect(state.activeEmployeeId).toBeNull();
    expect(state.employeeName).toBe('Owner / Admin');
  });

  test('exposes no client-side login that can grant a session', () => {
    expect((useAuthStore.getState() as unknown as Record<string, unknown>).login).toBeUndefined();
  });

  test('should login with employee details and save token to localStorage', () => {
    useAuthStore
      .getState()
      .loginWithEmployee(
        '0771234567',
        'manager',
        'John Cashier',
        'biz-123',
        'emp-456',
        'test-jwt-token'
      );

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(state.userPhone).toBe('0771234567');
    expect(state.userRole).toBe('manager');
    expect(state.employeeName).toBe('John Cashier');
    expect(state.activeBusinessId).toBe('biz-123');
    expect(state.activeEmployeeId).toBe('emp-456');
    expect(localStorage.getItem('auth_token')).toBe('test-jwt-token');
  });

  test('should login with employee without token (no localStorage write)', () => {
    useAuthStore.getState().loginWithEmployee(
      '0771234567',
      'cashier',
      'Jane Doe',
      'biz-999',
      'emp-999'
      // no token argument
    );

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  test('should strip whitespace from phone during loginWithEmployee', () => {
    useAuthStore.getState().loginWithEmployee('077 123 4567', 'cashier', 'Test', 'biz-1', 'emp-1');
    expect(useAuthStore.getState().userPhone).toBe('0771234567');
  });

  test('should clear all credentials and remove auth_token on logout', () => {
    useAuthStore
      .getState()
      .loginWithEmployee(
        '0771234567',
        'manager',
        'John Cashier',
        'biz-123',
        'emp-456',
        'test-jwt-token'
      );

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.userPhone).toBeNull();
    expect(state.userRole).toBe('admin');
    expect(state.employeeName).toBe('Owner / Admin');
    expect(state.activeBusinessId).toBeNull();
    expect(state.activeEmployeeId).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  // ─── Individual setters ──────────────────────────────────────────

  test('setSession should update the session field', () => {
    const fakeSession = { access_token: 'abc', user: null } as unknown as Session;
    useAuthStore.getState().setSession(fakeSession);
    expect(useAuthStore.getState().session).toEqual(fakeSession);

    useAuthStore.getState().setSession(null);
    expect(useAuthStore.getState().session).toBeNull();
  });

  test('setUser should update the user field', () => {
    const fakeUser = { id: 'u-123', email: 'test@shop.com' } as unknown as User;
    useAuthStore.getState().setUser(fakeUser);
    expect(useAuthStore.getState().user).toEqual(fakeUser);

    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('setActiveBusinessId should update the activeBusinessId field', () => {
    useAuthStore.getState().setActiveBusinessId('biz-new');
    expect(useAuthStore.getState().activeBusinessId).toBe('biz-new');

    useAuthStore.getState().setActiveBusinessId(null);
    expect(useAuthStore.getState().activeBusinessId).toBeNull();
  });

  test('setActiveEmployeeId should update the activeEmployeeId field', () => {
    useAuthStore.getState().setActiveEmployeeId('emp-new');
    expect(useAuthStore.getState().activeEmployeeId).toBe('emp-new');

    useAuthStore.getState().setActiveEmployeeId(null);
    expect(useAuthStore.getState().activeEmployeeId).toBeNull();
  });

  test('should support SSR environments where window is undefined', async () => {
    vi.resetModules();
    const originalWindow = global.window;

    Object.defineProperty(global, 'window', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { useAuthStore: ssrStore } = await import('../../stores/authStore');
    expect(ssrStore).toBeDefined();

    ssrStore.getState().logout();

    // Restore window
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });
});
