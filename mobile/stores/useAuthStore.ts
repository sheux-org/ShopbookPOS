import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { useCart } from './useCart';

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
  loginWithEmployee: (
    phone: string,
    role: UserRole,
    employeeName: string,
    businessId: string,
    employeeId: string,
    token?: string
  ) => void;
  login: (phone: string, otp: string) => boolean;
  logout: () => void;
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
      loginWithEmployee: (phone, role, employeeName, businessId, employeeId, token) => {
        const cleanPhone = phone.replace(/\s+/g, '');
        set({
          isLoggedIn: true,
          userPhone: cleanPhone,
          userRole: role,
          employeeName: employeeName,
          activeBusinessId: businessId,
          activeEmployeeId: employeeId,
        });
        if (token) {
          SecureStore.setItemAsync('auth_token', token).catch((err) => {
            console.error('Failed to store token in SecureStore:', err);
          });
        }
      },
      login: (phone, otp) => {
        const cleanPhone = phone.replace(/\s+/g, '');
        if (otp === '11111') {
          set({
            isLoggedIn: true,
            userPhone: cleanPhone,
            userRole: 'admin',
            employeeName: 'Owner / Admin',
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
          activeEmployeeId: null,
        });
        SecureStore.deleteItemAsync('auth_token').catch((err) => {
          console.error('Failed to delete token from SecureStore:', err);
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
