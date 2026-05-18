import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { useCart } from './useCart';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoggedIn: boolean;
  userPhone: string | null;
  activeBusinessId: string | null;
  activeEmployeeId: string | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setActiveBusinessId: (id: string | null) => void;
  setActiveEmployeeId: (id: string | null) => void;
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
      activeBusinessId: null,
      activeEmployeeId: null,
      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      setActiveBusinessId: (activeBusinessId) => set({ activeBusinessId }),
      setActiveEmployeeId: (activeEmployeeId) => set({ activeEmployeeId }),
      login: (phone, otp) => {
        const cleanPhone = phone.replace(/\s+/g, "");
        if (otp === "1111") {
          set({ isLoggedIn: true, userPhone: cleanPhone });
          return true;
        }
        return false;
      },
      logout: () => {
        set({ isLoggedIn: false, session: null, user: null, userPhone: null });
        useCart.getState().clearCart();
      },
      signOut: () => {
        set({ session: null, user: null, activeBusinessId: null, activeEmployeeId: null, isLoggedIn: false, userPhone: null });
        useCart.getState().clearCart();
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
