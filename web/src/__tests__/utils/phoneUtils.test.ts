import { describe, test, expect, vi, beforeEach } from 'vitest';
import { normalizePhone, isValidPhone, checkPhoneAvailability } from '../../utils/phoneUtils';

describe('phoneUtils', () => {
  describe('normalizePhone', () => {
    test('should normalize 10-digit number with leading zero', () => {
      expect(normalizePhone('0771234567')).toBe('771234567');
      expect(normalizePhone('0719876543')).toBe('719876543');
    });

    test('should normalize international format with +94', () => {
      expect(normalizePhone('+94771234567')).toBe('771234567');
      expect(normalizePhone('+94 77 123 4567')).toBe('771234567');
      expect(normalizePhone('94771234567')).toBe('771234567');
    });

    test('should handle spaces, dashes, parentheses and special characters', () => {
      expect(normalizePhone('+94 (77) 123-4567')).toBe('771234567');
      expect(normalizePhone('077-123-4567')).toBe('771234567');
    });

    test('should return empty string for null, undefined, or empty inputs', () => {
      expect(normalizePhone('')).toBe('');
      expect(normalizePhone(null as any)).toBe('');
      expect(normalizePhone(undefined as any)).toBe('');
    });
  });

  describe('isValidPhone', () => {
    test('should validate valid 9-digit normalized phones', () => {
      expect(isValidPhone('0771234567')).toBe(true);
      expect(isValidPhone('+94771234567')).toBe(true);
      expect(isValidPhone('771234567')).toBe(true);
    });

    test('should invalidate invalid phone lengths', () => {
      expect(isValidPhone('12345')).toBe(false);
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone('077123456789')).toBe(false);
    });
  });

  describe('checkPhoneAvailability', () => {
    let mockDatabase: any;
    let mockSupabase: any;

    beforeEach(() => {
      mockDatabase = {
        get: vi.fn((table: string) => {
          if (table === 'employees') {
            return {
              query: vi.fn().mockReturnValue({
                fetch: vi
                  .fn()
                  .mockResolvedValue([{ id: 'emp-1', name: 'Nimal', phone: '0771112233' }]),
              }),
            };
          }
          if (table === 'businesses') {
            return {
              query: vi.fn().mockReturnValue({
                fetch: vi
                  .fn()
                  .mockResolvedValue([
                    { id: 'biz-1', name: 'Super Store', phoneNumber: '0779998877' },
                  ]),
              }),
            };
          }
          return { query: vi.fn().mockReturnValue({ fetch: vi.fn().mockResolvedValue([]) }) };
        }),
      };

      mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: { exists: false },
          error: null,
        }),
      };
    });

    test('should detect phone number already registered to local employee', async () => {
      const result = await checkPhoneAvailability({
        phone: '+94 77 111 2233',
        database: mockDatabase,
        supabase: mockSupabase,
      });

      expect(result.isRegistered).toBe(true);
      expect(result.type).toBe('employee');
      expect(result.name).toBe('Nimal');
    });

    test('should exclude current employee ID when checking availability', async () => {
      const result = await checkPhoneAvailability({
        phone: '0771112233',
        excludeEmployeeId: 'emp-1',
        database: mockDatabase,
        supabase: mockSupabase,
      });

      expect(result.isRegistered).toBe(false);
    });

    test('should detect phone number already registered to local business owner', async () => {
      const result = await checkPhoneAvailability({
        phone: '0779998877',
        database: mockDatabase,
        supabase: mockSupabase,
      });

      expect(result.isRegistered).toBe(true);
      expect(result.type).toBe('owner');
      expect(result.businessName).toBe('Super Store');
    });

    test('should detect phone number registered remotely via Supabase RPC', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          exists: true,
          type: 'employee',
          name: 'Kamal',
          business_name: 'Remote Store',
        },
        error: null,
      });

      const result = await checkPhoneAvailability({
        phone: '0715554433',
        database: mockDatabase,
        supabase: mockSupabase,
      });

      expect(result.isRegistered).toBe(true);
      expect(result.name).toBe('Kamal');
      expect(result.businessName).toBe('Remote Store');
    });

    test('should return isRegistered false when phone is unique everywhere', async () => {
      const result = await checkPhoneAvailability({
        phone: '0701234567',
        database: mockDatabase,
        supabase: mockSupabase,
      });

      expect(result.isRegistered).toBe(false);
    });
  });
});
