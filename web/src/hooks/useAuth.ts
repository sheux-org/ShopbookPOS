import { useMutation, useQueryClient } from '@tanstack/react-query';
import database from '../db/database';
import { supabase } from '../services/supabaseClient';
import { syncDatabase } from '../services/sync';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import { useSettingsStore } from '../stores/settingsStore';
import { normalizePhone, toE164 } from '../utils/phoneUtils';

function authErrorMessage(error: { status?: number; message: string }): string {
  if (error.status === 429) {
    return 'Too many requests. You have exceeded the login limit. Please try again in a little while.';
  }
  return error.message;
}

export function useSendOtp() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const cleanPhone = normalizePhone(phone);
      if (cleanPhone.length !== 9) {
        throw new Error('Please enter a valid mobile number!');
      }
      const { error } = await supabase.auth.signInWithOtp({ phone: toE164(cleanPhone) });
      if (error) throw new Error(authErrorMessage(error));
    },
  });
}

export function useVerifyOtp() {
  const queryClient = useQueryClient();
  const loadBusinesses = useBusinessStore((s) => s.loadBusinessesFromDb);

  return useMutation({
    mutationFn: async (params: { phone: string; otp: string }) => {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: toE164(normalizePhone(params.phone)),
        token: params.otp,
        type: 'sms',
      });
      if (error || !data.session) {
        throw new Error(error ? authErrorMessage(error) : 'Invalid OTP code!');
      }
      const cleanPhone = normalizePhone(data.session.user.phone ?? params.phone);

      const allEmployees = await database.get('employees').query().fetch();
      const matchedEmployee = allEmployees.find((emp: any) => {
        return normalizePhone(emp.phone || '') === cleanPhone;
      }) as any;

      if (matchedEmployee) {
        const activeBiz = await matchedEmployee.business.fetch();
        if (activeBiz) {
          return {
            status: 'success' as const,
            phone: cleanPhone,
            role: matchedEmployee.role || 'cashier',
            name: matchedEmployee.name || 'Staff Member',
            businessId: activeBiz.id,
            employeeId: matchedEmployee.id,
          };
        }
      }

      const allBusinesses = await database.get('businesses').query().fetch();
      const matchedBiz = allBusinesses.find((biz: any) => {
        return normalizePhone(biz.phoneNumber || '') === cleanPhone;
      });

      if (matchedBiz) {
        return {
          status: 'success' as const,
          phone: cleanPhone,
          role: 'admin',
          name: 'Owner / Admin',
          businessId: matchedBiz.id,
          employeeId: 'owner',
        };
      }

      // Nothing local: ask the server who this verified phone is.
      const { data: remoteData, error: remoteError } = await supabase.rpc(
        'check_phone_registered',
        { input_phone: cleanPhone }
      );
      if (remoteError) {
        console.error('Failed to query remote synced account from Supabase:', remoteError);
      } else if (remoteData && remoteData.exists) {
        useSettingsStore.getState().setBackupEnabled(true);
        return {
          status: 'success' as const,
          phone: cleanPhone,
          role: remoteData.role || 'admin',
          name: remoteData.name || 'Owner / Admin',
          businessId: remoteData.business_id,
          employeeId: remoteData.employee_id || 'owner',
        };
      }

      return {
        status: 'not_found' as const,
        phone: cleanPhone,
      };
    },
    onSuccess: async (data) => {
      if (data.status === 'success') {
        useAuthStore
          .getState()
          .loginWithEmployee(data.phone, data.role, data.name, data.businessId, data.employeeId);
        // The pull needs the session's business id, so it runs after login.
        await syncDatabase();
        await loadBusinesses();
        useBusinessStore.getState().setActiveBusiness(data.businessId);
        queryClient.invalidateQueries({ queryKey: ['businesses'] });
      }
    },
  });
}
