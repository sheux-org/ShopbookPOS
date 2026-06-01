import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Session, User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'manager' | 'cashier';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoggedIn: boolean;
  userPhone: string | null;
  userRole: UserRole;
  employeeName: string | null;
  activeBusinessId: string | null;
  activeEmployeeId: string | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setActiveBusinessId: (id: string | null) => void;
  setActiveEmployeeId: (id: string | null) => void;
  loginWithEmployee: (phone: string, role: UserRole, employeeName: string, businessId: string, employeeId: string, token?: string) => void;
  login: (phone: string, otp: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      isLoggedIn: false,
      userPhone: null,
      userRole: 'admin',
      employeeName: 'Owner / Admin',
      activeBusinessId: null,
      activeEmployeeId: null,
      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      setActiveBusinessId: (activeBusinessId) => set({ activeBusinessId }),
      setActiveEmployeeId: (activeEmployeeId) => set({ activeEmployeeId }),
      loginWithEmployee: (phone, role, employeeName, businessId, employeeId, token) => {
        const cleanPhone = phone.replace(/\s+/g, "");
        set({
          isLoggedIn: true,
          userPhone: cleanPhone,
          userRole: role,
          employeeName: employeeName,
          activeBusinessId: businessId,
          activeEmployeeId: employeeId
        });
        if (token && typeof window !== 'undefined') {
          localStorage.setItem("auth_token", token);
        }
      },
      login: (phone, otp) => {
        const cleanPhone = phone.replace(/\s+/g, "");
        if (otp === "11111") {
          set({ 
            isLoggedIn: true, 
            userPhone: cleanPhone,
            userRole: 'admin',
            employeeName: 'Owner / Admin'
          });
          return true;
        }
        return false;
      },
      logout: () => {
        set({ 
          isLoggedIn: false, 
          session: null, 
          user: null, 
          userPhone: null,
          userRole: 'admin',
          employeeName: 'Owner / Admin',
          activeBusinessId: null,
          activeEmployeeId: null
        });
        if (typeof window !== 'undefined') {
          localStorage.removeItem("auth_token");
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
    }
  )
);
