import { useMutation, useQueryClient } from '@tanstack/react-query';
import database from '../components/data/db';
import { supabase, syncDatabase } from '../services/sync';
import { useAuthStore } from '../stores/useAuthStore';
import { useBusinessStore } from '../stores/useBusinessStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { SEEDING_PRODUCTS } from '../utils/seedProducts';
import { checkPhoneAvailability, normalizePhone } from '../utils/phoneUtils';
import { bootstrapEntitlement } from '../services/entitlement';

export function useVerifyOtp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { phone: string; otp: string; token: string }) => {
      const { phone, otp, token } = params;
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

        if (response.status === 429) {
          throw new Error(
            'Too many requests. You have exceeded the login limit. Please try again in a little while.'
          );
        }

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

      // Businesses before employees, matching check_phone_registered on the
      // server. Registration also creates an employees row carrying the
      // owner's own phone, so checking employees first reported every owner
      // as staff — the inversion that made ownership unresolvable on the
      // client and cost this app its entire purchase path.
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

      // If not found locally, check if there is a synced account in the Supabase database
      try {
        const { data: remoteData, error: remoteError } = await supabase.rpc(
          'check_phone_registered',
          {
            input_phone: cleanPhone,
          }
        );

        if (remoteError) {
          console.error('Failed to query remote synced account from Supabase:', remoteError);
        } else if (remoteData && remoteData.exists) {
          // Backup on; the pull itself happens in onSuccess. syncDatabase
          // aborts when activeBusinessId is null, and the session that sets it
          // is not established until this mutation resolves — so calling it
          // here never once pulled a row.
          useSettingsStore.getState().setBackupEnabled(true);

          return {
            status: 'success' as const,
            type: remoteData.type as 'employee' | 'owner',
            phone: cleanPhone,
            role: remoteData.role,
            name: remoteData.name,
            businessId: remoteData.business_id,
            employeeId: remoteData.employee_id || 'owner',
          };
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
        // Now that the session carries a business id, the pull can run. A
        // device signing in against an account that already exists in the
        // cloud has an empty local database until this happens.
        await syncDatabase();

        await useBusinessStore.getState().loadBusinessesFromDb();
        useBusinessStore.getState().setActiveBusiness(data.businessId!);

        // Invalidate businesses query cache so it reloads immediately!
        queryClient.invalidateQueries({ queryKey: ['businesses'] });

        // Identify the owner to RevenueCat (owners only) and load entitlement.
        void bootstrapEntitlement({
          phone: data.phone!,
          businessId: data.businessId!,
          isOwner: data.type === 'owner',
        });
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
      const cleanPhone = normalizePhone(phone);

      if (!cleanPhone || cleanPhone.length < 9) {
        throw new Error('Please enter a valid phone number.');
      }

      // Check phone uniqueness locally and in Cloud
      const phoneCheck = await checkPhoneAvailability({
        phone: cleanPhone,
        database,
        supabase,
      });

      if (phoneCheck.isRegistered) {
        throw new Error('This phone number is already registered.');
      }

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

      // A freshly registered user is by definition the owner.
      void bootstrapEntitlement({
        phone: data.phone,
        businessId: data.businessId,
        isOwner: true,
      });

      // Automatically trigger sync to cloud
      syncDatabase().catch((err) => {
        console.error('Auto sync after registration failed:', err);
      });
    },
  });
}
