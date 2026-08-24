import { Q } from '@nozbe/watermelondb';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import database from '../db/database';
import { supabase, syncDatabase } from '../services/sync';
import { checkPhoneAvailability, normalizePhone } from '../utils/phoneUtils';

export interface StaffMember {
  id: string;
  name: string;
  role: 'Admin' | 'Manager' | 'Cashier';
  email: string;
  phone: string;
}

export function useStaff(businessId: string) {
  return useQuery<StaffMember[]>({
    queryKey: ['staff', businessId],
    queryFn: async () => {
      if (!businessId || businessId === '0') return [];

      const dbEmployees = await database
        .get('employees')
        .query(Q.where('business_id', businessId))
        .fetch();

      return dbEmployees.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        role: emp.role === 'admin' ? 'Admin' : emp.role === 'manager' ? 'Manager' : 'Cashier',
        email: emp.email || 'no-email@shopbook.lk',
        phone: emp.phone,
      }));
    },
    enabled: !!businessId && businessId !== '0',
  });
}

export function useCreateStaff(businessId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      role: 'Admin' | 'Manager' | 'Cashier';
      phone: string;
      email?: string;
    }) => {
      const { name, role, phone, email } = params;
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

      const businesses = await database.get('businesses').query(Q.where('id', businessId)).fetch();
      const dbBiz = businesses[0];

      if (!dbBiz) {
        throw new Error('No business registered in SQLite database!');
      }

      const dbRole = role === 'Admin' ? 'admin' : role === 'Manager' ? 'manager' : 'cashier';

      await database.write(async () => {
        await database.get('employees').create((emp: any) => {
          emp.business.set(dbBiz);
          emp.name = name.trim();
          emp.role = dbRole;
          emp.phone = cleanPhone;
          emp.email = (email || '').trim();
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', businessId] });
      syncDatabase().catch((err) => {
        console.error('Failed to sync staff addition to cloud:', err);
      });
    },
  });
}

export function useUpdateStaff(businessId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name: string;
      role: 'Admin' | 'Manager' | 'Cashier';
      phone: string;
      email?: string;
    }) => {
      const { id, name, role, phone, email } = params;
      const employees = await database.get('employees').query(Q.where('id', id)).fetch();
      if (employees.length === 0) {
        throw new Error('Staff member not found in database!');
      }

      const targetEmp = employees[0] as any;
      const cleanPhone = normalizePhone(phone);

      if (!cleanPhone || cleanPhone.length < 9) {
        throw new Error('Please enter a valid phone number.');
      }

      // Check phone uniqueness excluding current employee
      const phoneCheck = await checkPhoneAvailability({
        phone: cleanPhone,
        excludeEmployeeId: id,
        database,
        supabase,
      });

      if (phoneCheck.isRegistered) {
        throw new Error('This phone number is already registered.');
      }

      const dbRole = role === 'Admin' ? 'admin' : role === 'Manager' ? 'manager' : 'cashier';
      const businesses = await database.get('businesses').query(Q.where('id', businessId)).fetch();
      const dbBiz = businesses[0] as any;
      const ownerPhone = dbBiz?.phoneNumber ? normalizePhone(dbBiz.phoneNumber) : '';

      const isOwner =
        targetEmp.name.toLowerCase() === 'owner / admin' ||
        (ownerPhone !== '' && normalizePhone(targetEmp.phone) === ownerPhone);

      if (isOwner && dbRole !== 'admin') {
        throw new Error('Owner / Admin role cannot be changed.');
      }

      await database.write(async () => {
        await targetEmp.update((emp: any) => {
          emp.name = name.trim();
          emp.role = dbRole;
          emp.phone = cleanPhone;
          emp.email = (email || '').trim();
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', businessId] });
      syncDatabase().catch((err) => {
        console.error('Failed to sync staff update to cloud:', err);
      });
    },
  });
}

export function useDeleteStaff(businessId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const employees = await database.get('employees').query(Q.where('id', id)).fetch();
      if (employees.length === 0) {
        throw new Error('Staff member not found in database!');
      }

      const targetEmp = employees[0] as any;
      const businesses = await database.get('businesses').query(Q.where('id', businessId)).fetch();
      const dbBiz = businesses[0] as any;
      const ownerPhone = dbBiz?.phoneNumber ? normalizePhone(dbBiz.phoneNumber) : '';

      const isOwner =
        targetEmp.name.toLowerCase() === 'owner / admin' ||
        (ownerPhone !== '' && normalizePhone(targetEmp.phone) === ownerPhone);

      if (isOwner) {
        throw new Error('Owner / Admin cannot be deleted.');
      }

      await database.write(async () => {
        await targetEmp.markAsDeleted();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', businessId] });
      syncDatabase().catch((err) => {
        console.error('Failed to sync staff deletion to cloud:', err);
      });
    },
  });
}
