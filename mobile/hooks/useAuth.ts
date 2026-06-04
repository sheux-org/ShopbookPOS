import { useMutation, useQueryClient } from '@tanstack/react-query';
import database from '../components/data/db';
import { supabase, syncDatabase } from '../services/sync';
import { useAuthStore } from '../stores/useAuthStore';
import { useBusinessStore } from '../stores/useBusinessStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { SEEDING_PRODUCTS } from '../utils/seedProducts';

export function useVerifyOtp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { phone: string; otp: string; token: string }) => {
      const { phone, otp, token } = params;

      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, '');
        if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
        if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
        return cleaned;
      };

      const cleanPhone = normalizePhone(phone);

      // Call real verification API
      try {
        const response = await fetch('https://mini-pos-sync-server.vercel.app/api/v1/auth/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            code: otp,
            phone_number: cleanPhone,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Invalid OTP code!');
        }

        const data = await response.json();
        if (data.message !== 'Success') {
          throw new Error(data.message || 'Invalid OTP code!');
        }
      } catch (err: any) {
        throw new Error(err.message || 'Verification failed. Please try again.');
      }

      const allEmployees: any[] = await database.get('employees').query().fetch();

      const matchedEmployee: any = allEmployees.find((emp: any) => {
        return normalizePhone(emp.phone || '') === cleanPhone;
      });

      if (matchedEmployee) {
        const bizRelation = matchedEmployee.business;
        const activeBiz = await bizRelation.fetch();
        if (activeBiz) {
          return {
            status: 'success' as const,
            type: 'employee' as const,
            phone: cleanPhone,
            role: matchedEmployee.role || 'cashier',
            name: matchedEmployee.name || 'Staff Member',
            businessId: activeBiz.id,
            employeeId: matchedEmployee.id,
          };
        }
      }

      const allBusinesses: any[] = await database.get('businesses').query().fetch();
      const matchedBiz: any = allBusinesses.find((biz: any) => {
        return normalizePhone(biz.phoneNumber || '') === cleanPhone;
      });

      if (matchedBiz) {
        return {
          status: 'success' as const,
          type: 'owner' as const,
          phone: cleanPhone,
          role: 'admin',
          name: 'Owner / Admin',
          businessId: matchedBiz.id,
          employeeId: 'owner',
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
        } else if (remoteData) {
          if (remoteData.exists) {
            // Set backup/sync as enabled in settings store
            useSettingsStore.getState().setBackupEnabled(true);

            // Force sync to pull all tables (businesses, employees, products, orders, etc.) from Supabase
            console.log('Found synced account on Supabase. Triggering database sync...');
            const syncSuccess = await syncDatabase();
            console.log('Database sync finished with success status:', syncSuccess);

            return {
              status: 'success' as const,
              type: remoteData.type as 'employee' | 'owner',
              phone: cleanPhone,
              role: remoteData.role,
              name: remoteData.name,
              businessId: remoteData.business_id,
              employeeId: remoteData.employee_id,
            };
          }
        }
      } catch (supabaseErr) {
        console.error('Error checking remote synced account on Supabase:', supabaseErr);
      }

      return {
        status: 'register' as const,
        phone: cleanPhone,
      };
    },
    onSuccess: async (data, variables) => {
      if (data.status === 'success') {
        useAuthStore
          .getState()
          .loginWithEmployee(
            data.phone!,
            data.role as any,
            data.name!,
            data.businessId!,
            data.employeeId!,
            variables.token
          );
        await useBusinessStore.getState().loadBusinessesFromDb();
        useBusinessStore.getState().setActiveBusiness(data.businessId!);

        // Invalidate businesses query cache so it reloads immediately!
        queryClient.invalidateQueries({ queryKey: ['businesses'] });
      }
    },
  });
}

export function useRegisterUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      phone: string;
      businessName: string;
      category: string;
      address: string;
    }) => {
      const { phone, businessName, category, address } = params;
      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, '');
        if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
        if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
        return cleaned;
      };

      const cleanPhone = normalizePhone(phone);

      let newBizRecord: any;
      let newEmpRecord: any;

      await database.write(async () => {
        newBizRecord = await database.get('businesses').create((biz: any) => {
          biz.name = businessName;
          biz.businessType = category;
          biz.address = address;
          biz.phoneNumber = cleanPhone;
        });

        newEmpRecord = await database.get('employees').create((emp: any) => {
          emp.business.set(newBizRecord);
          emp.name = 'Owner / Admin';
          emp.role = 'admin';
          emp.phone = cleanPhone;
        });
      });

      // Seed products ONLY for the very first registered store in SQLite!
      const dbBizs = await database.get('businesses').query().fetch();
      if (dbBizs.length === 1) {
        // Use centralized seed data to avoid duplication and 404 image issues
        await database.write(async () => {
          for (const item of SEEDING_PRODUCTS) {
            await database.get('products').create((p: any) => {
              p.business.set(newBizRecord);
              p.name = item.name;
              p.price = item.price;
              p.category = item.category;
              p.icon = item.icon;
              p.stockCount = item.stockCount;
              p.unitType = item.unitType;
              p.costPrice = item.costPrice;
              p.quickCode = item.quickCode;
            });
          }
        });
      }

      return {
        phone: cleanPhone,
        businessId: newBizRecord.id,
        employeeId: newEmpRecord.id,
      };
    },
    onSuccess: async (data) => {
      useAuthStore
        .getState()
        .loginWithEmployee(data.phone, 'admin', 'Owner / Admin', data.businessId, data.employeeId);
      await useBusinessStore.getState().loadBusinessesFromDb();
      useBusinessStore.getState().setActiveBusiness(data.businessId);

      // Invalidate businesses query cache!
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });
}
