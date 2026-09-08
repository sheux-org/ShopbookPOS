import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../../stores/authStore';

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

  test('should login with employee details', () => {
    useAuthStore
      .getState()
      .loginWithEmployee('0771234567', 'manager', 'John Cashier', 'biz-123', 'emp-456');

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(state.userPhone).toBe('0771234567');
    expect(state.userRole).toBe('manager');
    expect(state.employeeName).toBe('John Cashier');
    expect(state.activeBusinessId).toBe('biz-123');
    expect(state.activeEmployeeId).toBe('emp-456');
  });

  test('never persists a bearer token of its own', () => {
    useAuthStore
      .getState()
      .loginWithEmployee('0771234567', 'cashier', 'Jane Doe', 'biz-999', 'emp-999');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  test('should strip whitespace from phone during loginWithEmployee', () => {
    useAuthStore.getState().loginWithEmployee('077 123 4567', 'cashier', 'Test', 'biz-1', 'emp-1');
    expect(useAuthStore.getState().userPhone).toBe('0771234567');
  });

  test('should clear all credentials on logout', () => {
    useAuthStore
      .getState()
      .loginWithEmployee('0771234567', 'manager', 'John Cashier', 'biz-123', 'emp-456');

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.userPhone).toBeNull();
    expect(state.userRole).toBe('admin');
    expect(state.employeeName).toBe('Owner / Admin');
    expect(state.activeBusinessId).toBeNull();
    expect(state.activeEmployeeId).toBeNull();
  });

  // ─── Individual setters ──────────────────────────────────────────

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
