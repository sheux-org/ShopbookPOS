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

// Clean onboarding state when no business is registered yet
const PLACEHOLDER_BUSINESS: Business = {
  id: "0",
  name: "Register Your Shop",
  category: "General Retail",
  address: "Complete onboarding setup",
  phone: "",
};

const DEFAULT_BUSINESSES: Business[] = [PLACEHOLDER_BUSINESS];

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
          const dbBizs = await db.get('businesses').query().fetch();
          
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
          } else {
            set({
              businesses: [PLACEHOLDER_BUSINESS],
              activeBusiness: PLACEHOLDER_BUSINESS,
            });
          }
        } catch (err) {
          console.error('Failed to load businesses from SQLite:', err);
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
          
          // Seed products ONLY for the very first registered store in SQLite!
          const dbBizs = await db.get('businesses').query().fetch();
          if (dbBizs.length === 1) {
            console.log('First brand business registered. Seeding dynamic inventory catalog in SQLite...');
            const existingProducts = await db.get('products').query().fetch();
            if (existingProducts.length === 0) {
              const SEEDING_PRODUCTS = [
                { name: "Anchor Milk 1L", price: 680, category: "dairy", icon: "🥛", stockCount: 24, unitType: "Liters", costPrice: 580, quickCode: "1001" },
                { name: "Highland Yogurt", price: 95, category: "dairy", icon: "🥣", stockCount: 38, unitType: "Pieces", costPrice: 75, quickCode: "1008" },
                { name: "Marie Biscuits", price: 180, category: "snacks", icon: "🍪", stockCount: 4, unitType: "Packets", costPrice: 140, quickCode: "1002" },
                { name: "Lemon Puff 200g", price: 250, category: "snacks", icon: "🥮", stockCount: 16, unitType: "Packets", costPrice: 200, quickCode: "1004" },
                { name: "Cream Soda 1.5L", price: 320, category: "drinks", icon: "🥤", stockCount: 22, unitType: "Liters", costPrice: 260, quickCode: "1003" },
                { name: "Pepsi 1L", price: 280, category: "drinks", icon: "🥤", stockCount: 0, unitType: "Liters", costPrice: 220, quickCode: "1009" },
                { name: "Sunlight Soap", price: 130, category: "grocery", icon: "🧼", stockCount: 15, unitType: "Pieces", costPrice: 100, quickCode: "1005" },
                { name: "Red Rice 1kg", price: 280, category: "grocery", icon: "🌾", stockCount: 18, unitType: "kg", costPrice: 230, quickCode: "1006" },
                { name: "Ceylon Tea", price: 450, category: "drinks", icon: "☕", stockCount: 2, unitType: "Packets", costPrice: 380, quickCode: "1007" },
                { name: "Bread Loaf", price: 110, category: "grocery", icon: "🍞", stockCount: 12, unitType: "Pieces", costPrice: 85, quickCode: "1010" },
              ];
              
              await db.write(async () => {
                for (const item of SEEDING_PRODUCTS) {
                  await db.get('products').create((p: any) => {
                    p.business.set(newBusinessRecord);
                    p.name = item.name;
                    p.price = item.price;
                    p.category = item.category;
                    p.icon = item.icon;
                    p.stockCount = item.stockCount;
                    p.unitType = item.unitType;
                    p.costPrice = item.costPrice;
                    p.quickCode = item.quickCode;
                  });
                }
              });
              console.log('Successfully seeded catalog products for the first registered business!');
            }
          }
          
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
