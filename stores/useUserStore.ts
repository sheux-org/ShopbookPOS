import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  role: string;
  isVerified: boolean;
}

interface UserState {
  profile: UserProfile;
  updateProfile: (profile: Partial<UserProfile>) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: {
        name: 'Pahasara',
        email: 'pahasara@shopbook.lk',
        avatar: 'P',
        role: 'Pro Member',
        isVerified: true,
      },
      updateProfile: (newProfile) =>
        set((state) => ({
          profile: { ...state.profile, ...newProfile },
        })),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
