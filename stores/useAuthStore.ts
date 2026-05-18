import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  activeBusinessId: string | null;
  activeEmployeeId: string | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setActiveBusinessId: (id: string | null) => void;
  setActiveEmployeeId: (id: string | null) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      activeBusinessId: null,
      activeEmployeeId: null,
      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      setActiveBusinessId: (activeBusinessId) => set({ activeBusinessId }),
      setActiveEmployeeId: (activeEmployeeId) => set({ activeEmployeeId }),
      signOut: () => set({ session: null, user: null, activeBusinessId: null, activeEmployeeId: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
