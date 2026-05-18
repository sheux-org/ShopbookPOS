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
  loadBusinessesFromDb: () => Promise<void>;
  registerBusiness: (name: string, address: string, phone: string, category?: string) => Promise<void>;
  updateActiveBusinessDetails: (details: { name: string; category: string; address: string; phone: string }) => Promise<void>;
}

// Only one default business for 0717133074 initially
const DEFAULT_BUSINESSES: Business[] = [
  { id: "1", name: "Shopbook Retailer", category: "Supermarket & Groceries", address: "142 Galle Road, Colombo 03", phone: "0717133074" },
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
      loadBusinessesFromDb: async () => {
        try {
          const db = require('../components/data/db').default;
          let dbBizs = await db.get('businesses').query().fetch();
          
          if (dbBizs.length === 0) {
            console.log('SQLite businesses table is empty. Seeding initial brand business...');
            await db.write(async () => {
              for (const biz of DEFAULT_BUSINESSES) {
                await db.get('businesses').create((b: any) => {
                  b.name = biz.name;
                  b.businessType = biz.category;
                  b.address = biz.address;
                  b.phoneNumber = biz.phone;
                });
              }
            });
            // Re-fetch
            dbBizs = await db.get('businesses').query().fetch();
          }
          
          // Only show businesses that belong to our owner phone number: 0717133074
          const filteredDbBizs = dbBizs.filter((b: any) => {
            const cleanPhone = b.phoneNumber ? b.phoneNumber.replace(/\s+/g, "") : "";
            return cleanPhone.includes("717133074") || cleanPhone.includes("0717133074");
          });
          
          const list: Business[] = filteredDbBizs.map((b: any) => ({
            id: b.id,
            name: b.name,
            category: b.businessType,
            address: b.address || "No Address Provided",
            phone: b.phoneNumber || "0717133074",
          }));
          
          if (list.length > 0) {
            set({
              businesses: list,
              activeBusiness: list.find(b => b.id === get().activeBusiness.id) || list[0]
            });
          }
        } catch (err) {
          console.error('Failed to load/seed businesses from SQLite:', err);
        }
      },
      registerBusiness: async (name, address, phone, category = "General Retail") => {
        try {
          const db = require('../components/data/db').default;
          let newBusinessRecord: any;
          await db.write(async () => {
            newBusinessRecord = await db.get('businesses').create((biz: any) => {
              biz.name = name;
              biz.businessType = category;
              biz.address = address;
              biz.phoneNumber = phone;
            });

            await db.get('employees').create((emp: any) => {
              emp.business.set(newBusinessRecord);
              emp.name = "Owner / Admin";
              emp.role = "admin";
              emp.phone = phone;
            });
          });
          console.log('Successfully saved business and admin employee to local database');
          
          await get().loadBusinessesFromDb();
          
          if (newBusinessRecord) {
            const found = get().businesses.find(b => b.name === name);
            if (found) {
              set({ activeBusiness: found });
            }
          }
        } catch (err) {
          console.error('Failed to write business/employee to local database:', err);
        }
      },
      updateActiveBusinessDetails: async (details) => {
        const activeBiz = get().activeBusiness;
        
        try {
          const db = require('../components/data/db').default;
          const { Q } = require('@nozbe/watermelondb');
          
          const businesses = await db.get('businesses').query(Q.where('id', activeBiz.id)).fetch();
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
          
          await get().loadBusinessesFromDb();
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
