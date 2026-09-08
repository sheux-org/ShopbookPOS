import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../services/supabaseClient';

export type UserRole = 'admin' | 'manager' | 'cashier';

interface AuthState {
  isLoggedIn: boolean;
  userPhone: string | null;
  userRole: UserRole;
  employeeName: string | null;
  activeBusinessId: string | null;
  activeEmployeeId: string | null;
  setActiveBusinessId: (id: string | null) => void;
  setActiveEmployeeId: (id: string | null) => void;
  loginWithEmployee: (
    phone: string,
    role: UserRole,
    employeeName: string,
    businessId: string,
    employeeId: string
  ) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      userPhone: null,
      userRole: 'admin',
      employeeName: 'Owner / Admin',
      activeBusinessId: null,
      activeEmployeeId: null,
      setActiveBusinessId: (activeBusinessId) => set({ activeBusinessId }),
      setActiveEmployeeId: (activeEmployeeId) => set({ activeEmployeeId }),
      loginWithEmployee: (phone, role, employeeName, businessId, employeeId) => {
        set({
          isLoggedIn: true,
          userPhone: phone.replace(/\s+/g, ''),
          userRole: role,
          employeeName,
          activeBusinessId: businessId,
          activeEmployeeId: employeeId,
        });
      },
      logout: () => {
        set({
          isLoggedIn: false,
          userPhone: null,
          userRole: 'admin',
          employeeName: 'Owner / Admin',
          activeBusinessId: null,
          activeEmployeeId: null,
        });
        void supabase.auth.signOut().catch(() => undefined);
      },
    }),
    {
      name: 'auth-storage',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
    }
  )
);
