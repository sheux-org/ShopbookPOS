import { Q } from '@nozbe/watermelondb';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import database from '../components/data/db';

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
      email: string;
      phone: string;
    }) => {
      const { name, role, email, phone } = params;
      const businesses = await database.get('businesses').query(Q.where('id', businessId)).fetch();
      const dbBiz = businesses[0];

      if (!dbBiz) {
        throw new Error('No business registered in SQLite database!');
      }

      const dbRole = role === 'Admin' ? 'admin' : role === 'Manager' ? 'manager' : 'cashier';

      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, '');
        if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
        if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
        return cleaned;
      };

      const cleanPhone = normalizePhone(phone);

      await database.write(async () => {
        await database.get('employees').create((emp: any) => {
          emp.business.set(dbBiz);
          emp.name = name;
          emp.role = dbRole;
          emp.phone = cleanPhone;
          emp.email = email;
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', businessId] });
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
      email: string;
      phone: string;
    }) => {
      const { id, name, role, email, phone } = params;
      const employees = await database.get('employees').query(Q.where('id', id)).fetch();
      if (employees.length === 0) {
        throw new Error('Staff member not found in database!');
      }

      const targetEmp = employees[0] as any;

      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, '');
        if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
        if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
        return cleaned;
      };

      const cleanPhone = normalizePhone(phone);
      const dbRole = role === 'Admin' ? 'admin' : role === 'Manager' ? 'manager' : 'cashier';
      const isOwner =
        targetEmp.role === 'admin' || targetEmp.name.toLowerCase() === 'owner / admin';

      if (isOwner && dbRole !== 'admin') {
        throw new Error('Owner / Admin role cannot be changed.');
      }

      await database.write(async () => {
        await targetEmp.update((emp: any) => {
          emp.name = name.trim();
          emp.role = dbRole;
          emp.phone = cleanPhone;
          emp.email = email.trim();
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', businessId] });
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
      const isOwner =
        targetEmp.role === 'admin' || targetEmp.name.toLowerCase() === 'owner / admin';
      if (isOwner) {
        throw new Error('Owner / Admin cannot be deleted.');
      }

      await database.write(async () => {
        await targetEmp.destroyPermanently();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', businessId] });
    },
  });
}
