import { Q, Database } from '@nozbe/watermelondb';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Normalizes Sri Lankan phone number to a standard 9-digit string format (e.g. '771234567').
 * Handles '+94', '94', leading '0', hyphens, and whitespace.
 */
export function normalizePhone(phoneStr: string): string {
  if (!phoneStr) return '';
  let cleaned = phoneStr.replace(/\D/g, '');
  if (cleaned.startsWith('94')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

/** Supabase Auth wants E.164. */
export function toE164(phoneStr: string): string {
  return `+94${normalizePhone(phoneStr)}`;
}

/**
 * Validates whether the given phone string normalizes to a valid 9-digit Sri Lankan phone number.
 */
export function isValidPhone(phoneStr: string): boolean {
  const normalized = normalizePhone(phoneStr);
  return normalized.length === 9;
}

export interface PhoneCheckResult {
  isRegistered: boolean;
  type?: 'owner' | 'employee';
  name?: string;
  businessName?: string;
  errorMessage?: string;
}

/**
 * Checks whether a phone number is already registered across:
 * 1. Local WatermelonDB database (employees and businesses tables)
 * 2. Remote Supabase Cloud database via `check_phone_registered` RPC
 *
 * @param options Phone number and optional exclusion IDs for updates
 */
export async function checkPhoneAvailability(options: {
  phone: string;
  excludeEmployeeId?: string | null;
  excludeBusinessId?: string | null;
  database: Database;
  supabase: SupabaseClient;
}): Promise<PhoneCheckResult> {
  const { phone, excludeEmployeeId, excludeBusinessId, database, supabase } = options;
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone || cleanPhone.length < 9) {
    return { isRegistered: false };
  }

  // 1. Check local WatermelonDB employees
  try {
    const allEmployees = await database.get('employees').query().fetch();
    const localEmpMatch: any = allEmployees.find((emp: any) => {
      if (excludeEmployeeId && emp.id === excludeEmployeeId) {
        return false;
      }
      return normalizePhone(emp.phone || '') === cleanPhone;
    });

    if (localEmpMatch) {
      return {
        isRegistered: true,
        type: 'employee',
        name: localEmpMatch.name || 'Staff Member',
        errorMessage: 'This phone number is already registered to another staff member or owner.',
      };
    }
  } catch (err) {
    console.warn('Local employee phone check warning:', err);
  }

  // 2. Check local WatermelonDB businesses (owner phone)
  try {
    const allBusinesses = await database.get('businesses').query().fetch();
    const localBizMatch: any = allBusinesses.find((biz: any) => {
      if (excludeBusinessId && biz.id === excludeBusinessId) {
        return false;
      }
      return normalizePhone(biz.phoneNumber || '') === cleanPhone;
    });

    if (localBizMatch) {
      return {
        isRegistered: true,
        type: 'owner',
        name: 'Owner / Admin',
        businessName: localBizMatch.name,
        errorMessage: 'This phone number is already registered to an existing business.',
      };
    }
  } catch (err) {
    console.warn('Local business phone check warning:', err);
  }

  // 3. Check Remote Supabase database via RPC
  try {
    if (typeof supabase?.rpc === 'function') {
      const { data: remoteData, error: remoteError } = await supabase.rpc(
        'check_phone_registered',
        {
          input_phone: cleanPhone,
          exclude_employee_id: excludeEmployeeId || null,
          exclude_business_id: excludeBusinessId || null,
        }
      );

      if (!remoteError && remoteData && remoteData.exists) {
        return {
          isRegistered: true,
          type: remoteData.type,
          name: remoteData.name,
          businessName: remoteData.business_name,
          errorMessage: 'This phone number is already registered in the cloud database.',
        };
      }
    }
  } catch (supabaseErr) {
    console.warn('Remote phone uniqueness check skipped (network error):', supabaseErr);
  }

  return { isRegistered: false };
}
