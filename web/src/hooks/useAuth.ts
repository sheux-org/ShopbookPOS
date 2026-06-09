import { useMutation, useQueryClient } from '@tanstack/react-query';
import database from '../db/database';
import { supabase, syncDatabase } from '../services/sync';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import { useSettingsStore } from '../stores/settingsStore';

export function useSendOtp() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, '');
        if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
        if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
        return cleaned;
      };

      const cleanPhone = normalizePhone(phone);
      if (cleanPhone.length !== 9) {
        throw new Error('Please enter a valid mobile number!');
      }

      const response = await fetch('/api/auth/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone_number: cleanPhone }),
      });

      if (response.status === 429) {
        throw new Error(
          'Too many requests. You have exceeded the login limit. Please try again in a little while.'
        );
      }

      if (!response.ok) {
        throw new Error('Failed to check phone number. Please try again.');
      }

      const data = await response.json();
      return data.token as string;
    },
  });
}

export function useVerifyOtp() {
  const queryClient = useQueryClient();
  const loginWithEmployee = useAuthStore((s) => s.loginWithEmployee);
  const loadBusinesses = useBusinessStore((s) => s.loadBusinessesFromDb);

  return useMutation({
    mutationFn: async (params: { phone: string; otp: string; verificationToken: string }) => {
      const { phone, otp, verificationToken } = params;

      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, '');
        if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
        if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
        return cleaned;
      };

      const cleanPhone = normalizePhone(phone);

      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${verificationToken}`,
        },
        body: JSON.stringify({
          code: otp,
          phone_number: cleanPhone,
        }),
      });

      if (response.status === 429) {
        throw new Error(
          'Too many requests. You have exceeded the login limit. Please try again in a little while.'
        );
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Invalid OTP code!');
      }

      const verifyData = await response.json();
      if (verifyData.message !== 'Success') {
        throw new Error(verifyData.message || 'Invalid OTP code!');
      }

      // Check local database for matched employee or business owner
      const allEmployees = await database.get('employees').query().fetch();
      const matchedEmployee = allEmployees.find((emp: any) => {
        return normalizePhone(emp.phone || '') === cleanPhone;
      }) as any;

      if (matchedEmployee) {
        const activeBiz = await matchedEmployee.business.fetch();
        if (activeBiz) {
          useAuthStore
            .getState()
            .loginWithEmployee(
              cleanPhone,
              matchedEmployee.role || 'cashier',
              matchedEmployee.name || 'Staff Member',
              activeBiz.id,
              matchedEmployee.id,
              verificationToken
            );

          await syncDatabase();

          return {
            status: 'success' as const,
            phone: cleanPhone,
            role: matchedEmployee.role || 'cashier',
            name: matchedEmployee.name || 'Staff Member',
            businessId: activeBiz.id,
            employeeId: matchedEmployee.id,
            token: verificationToken,
          };
        }
      }

      const allBusinesses = await database.get('businesses').query().fetch();
      const matchedBiz = allBusinesses.find((biz: any) => {
        return normalizePhone(biz.phoneNumber || '') === cleanPhone;
      });

      if (matchedBiz) {
        useAuthStore
          .getState()
          .loginWithEmployee(
            cleanPhone,
            'admin',
            'Owner / Admin',
            matchedBiz.id,
            'owner',
            verificationToken
          );

        await syncDatabase();

        return {
          status: 'success' as const,
          phone: cleanPhone,
          role: 'admin',
          name: 'Owner / Admin',
          businessId: matchedBiz.id,
          employeeId: 'owner',
          token: verificationToken,
        };
      }

      // If not found locally, check if there is a synced account in the Supabase database
      try {
        const { data: remoteData, error: remoteError } = await supabase.rpc(
          'check_synced_account',
          {
            input_phone: cleanPhone,
          }
        );

        if (remoteError) {
          console.error('Failed to query remote synced account from Supabase:', remoteError);
        } else if (remoteData && remoteData.exists) {
          useSettingsStore.getState().setBackupEnabled(true);

          // Store the auth_token BEFORE syncing so prepareSupabaseForSync can find it and authenticate
          if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', verificationToken);
          }

          useAuthStore
            .getState()
            .loginWithEmployee(
              cleanPhone,
              remoteData.role || 'admin',
              remoteData.name || 'Owner / Admin',
              remoteData.business_id,
              remoteData.employee_id || 'owner',
              verificationToken
            );

          // Force sync to pull all tables
          const syncSuccess = await syncDatabase();
          console.log('Database sync finished with status:', syncSuccess);

          return {
            status: 'success' as const,
            phone: cleanPhone,
            role: remoteData.role || 'admin',
            name: remoteData.name || 'Owner / Admin',
            businessId: remoteData.business_id,
            employeeId: remoteData.employee_id || 'owner',
            token: verificationToken,
            synced: true,
          };
        }
      } catch (supabaseErr) {
        console.error('Error checking remote synced account on Supabase:', supabaseErr);
      }

      return {
        status: 'not_found' as const,
        phone: cleanPhone,
      };
    },
    onSuccess: async (data) => {
      if (data.status === 'success') {
        loginWithEmployee(
          data.phone,
          data.role,
          data.name,
          data.businessId,
          data.employeeId,
          data.token
        );
        await loadBusinesses();
        useBusinessStore.getState().setActiveBusiness(data.businessId);

        // Invalidate query caches
        queryClient.invalidateQueries({ queryKey: ['businesses'] });
      }
    },
  });
}
