import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { useCart } from './useCart';
import { deleteSessionToken } from '../utils/secureStorage';

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
  loginWithEmployee: (phone: string, role: UserRole, employeeName: string, businessId: string, employeeId: string) => void;
  login: (phone: string, otp: string) => boolean;
  logout: () => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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
      loginWithEmployee: (phone, role, employeeName, businessId, employeeId) => {
        const cleanPhone = phone.replace(/\s+/g, "");
        set({
          isLoggedIn: true,
          userPhone: cleanPhone,
          userRole: role,
          employeeName: employeeName,
          activeBusinessId: businessId,
          activeEmployeeId: employeeId
        });
      },
      login: (phone, otp) => {
        const cleanPhone = phone.replace(/\s+/g, "");
        if (otp === "1111") {
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
        deleteSessionToken().catch((err) => console.error("Failed to delete token on logout:", err));
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
        useCart.getState().clearCart();
      },
      signOut: () => {
        deleteSessionToken().catch((err) => console.error("Failed to delete token on signOut:", err));
        set({ 
          session: null, 
          user: null, 
          activeBusinessId: null, 
          activeEmployeeId: null, 
          isLoggedIn: false, 
          userPhone: null,
          userRole: 'admin',
          employeeName: 'Owner / Admin'
        });
        useCart.getState().clearCart();
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
