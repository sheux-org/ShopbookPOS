import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
}

interface BusinessState {
  businesses: Business[];
  activeBusiness: Business;
  setActiveBusiness: (id: string) => void;
  registerBusiness: (name: string, address: string, phone: string, category?: string) => Promise<void>;
  updateActiveBusinessDetails: (details: { name: string; category: string; address: string; phone: string }) => Promise<void>;
}

const DEFAULT_BUSINESSES: Business[] = [
  { id: "1", name: "Shopbook Electronics", category: "Electronics & Gadgets", address: "142 Galle Road, Colombo 03", phone: "+94 11 234 5678" },
  { id: "2", name: "Shopbook Apparel", category: "Clothing & Fashion", address: "88 Peradeniya Road, Kandy", phone: "+94 81 234 5678" },
  { id: "3", name: "Shopbook Groceries", category: "Supermarket & Groceries", address: "55 Main Street, Galle Fort", phone: "+94 91 234 5678" },
];

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set, get) => ({
      businesses: DEFAULT_BUSINESSES,
      activeBusiness: DEFAULT_BUSINESSES[0],
      setActiveBusiness: (id) => {
        const found = get().businesses.find((b) => b.id === id);
        if (found) {
          set({ activeBusiness: found });
        }
      },
      registerBusiness: async (name, address, phone, category = "General Retail") => {
        const nextId = String(get().businesses.length + 1);
        const newBiz: Business = { id: nextId, name, category, address, phone };
        
        set({
          businesses: [...get().businesses, newBiz],
          activeBusiness: newBiz,
        });

        // Save business & admin employee to local database
        try {
          const db = require('../components/data/db').default;
          await db.write(async () => {
            const newBusiness = await db.get('businesses').create((biz: any) => {
              biz.name = name;
              biz.businessType = category;
              biz.address = address;
              biz.phoneNumber = phone;
            });

            await db.get('employees').create((emp: any) => {
              emp.business.set(newBusiness);
              emp.name = "Owner / Admin";
              emp.role = "admin";
              emp.phone = phone;
            });
          });
          console.log('Successfully saved business and admin employee to local database');
        } catch (err) {
          console.error('Failed to write business/employee to local database:', err);
        }
      },
      updateActiveBusinessDetails: async (details) => {
        const updatedBiz = {
          ...get().activeBusiness,
          ...details,
        };
        
        const updatedList = get().businesses.map((b) => b.id === updatedBiz.id ? updatedBiz : b);
        
        set({
          activeBusiness: updatedBiz,
          businesses: updatedList,
        });

        try {
          const db = require('../components/data/db').default;
          const { Q } = require('@nozbe/watermelondb');
          
          const businesses = await db.get('businesses').query(Q.where('phone_number', updatedBiz.phone)).fetch();
          if (businesses.length > 0) {
            const targetBiz = businesses[0];
            await db.write(async () => {
              await targetBiz.update((b: any) => {
                b.name = details.name;
                b.businessType = details.category;
                b.address = details.address;
                b.phoneNumber = details.phone;
              });
            });
            console.log('Successfully updated business details in local WatermelonDB database');
          } else {
            await db.write(async () => {
              await db.get('businesses').create((b: any) => {
                b.name = details.name;
                b.businessType = details.category;
                b.address = details.address;
                b.phoneNumber = details.phone;
              });
            });
            console.log('Successfully created business details in local WatermelonDB database');
          }
        } catch (err) {
          console.error('Failed to update business details in WatermelonDB:', err);
        }
      },
    }),
    {
      name: 'business-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
