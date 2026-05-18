import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { useCart } from './useCart';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoggedIn: boolean;
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
      activeBusinessId: null,
      activeEmployeeId: null,
      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      setActiveBusinessId: (activeBusinessId) => set({ activeBusinessId }),
      setActiveEmployeeId: (activeEmployeeId) => set({ activeEmployeeId }),
      login: (phone, otp) => {
        const cleanPhone = phone.replace(/\s+/g, "");
        if ((cleanPhone === "0717133074" || cleanPhone === "717133074") && otp === "1111") {
          set({ isLoggedIn: true });
          return true;
        }
        return false;
      },
      logout: () => {
        set({ isLoggedIn: false, session: null, user: null });
        useCart.getState().clearCart();
      },
      signOut: () => {
        set({ session: null, user: null, activeBusinessId: null, activeEmployeeId: null, isLoggedIn: false });
        useCart.getState().clearCart();
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
