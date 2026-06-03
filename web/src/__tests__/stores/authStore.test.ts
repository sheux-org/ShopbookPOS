import { describe, test, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.getState().logout();
  });

  test('should initialize with default logged-out state', () => {
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.userPhone).toBeNull();
    expect(state.userRole).toBe('admin');
    expect(state.activeBusinessId).toBeNull();
    expect(state.activeEmployeeId).toBeNull();
  });

  test('should login successfully with test OTP 11111', () => {
    const success = useAuthStore.getState().login('0771234567', '11111');
    expect(success).toBe(true);

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(state.userPhone).toBe('0771234567');
    expect(state.userRole).toBe('admin');
  });

  test('should fail login with incorrect OTP', () => {
    const success = useAuthStore.getState().login('0771234567', '99999');
    expect(success).toBe(false);

    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.userPhone).toBeNull();
  });

  test('should login with employee details and save token', () => {
    useAuthStore.getState().loginWithEmployee(
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

  test('should clear credentials on logout', () => {
    useAuthStore.getState().loginWithEmployee(
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
    expect(state.activeBusinessId).toBeNull();
    expect(state.activeEmployeeId).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });
});
