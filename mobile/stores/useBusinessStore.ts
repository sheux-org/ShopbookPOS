import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import database from '../components/data/db';
import { SEEDING_PRODUCTS } from '../utils/seedProducts';
import { useAuthStore } from './useAuthStore';
import { supabase, syncDatabase } from '../services/sync';
import { checkPhoneAvailability, normalizePhone } from '../utils/phoneUtils';

export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  logoUri?: string;
}

interface BusinessState {
  businesses: Business[];
  activeBusiness: Business;
  setActiveBusiness: (id: string) => void;
  loadBusinessesFromDb: () => Promise<void>;
  registerBusiness: (
    name: string,
    address: string,
    phone: string,
    category?: string
  ) => Promise<void>;
  updateActiveBusinessDetails: (details: {
    name: string;
    category: string;
    address: string;
    phone: string;
    logoUri?: string;
  }) => Promise<void>;
  updateBusinessDetails: (
    id: string,
    details: {
      name: string;
      category: string;
      address: string;
      phone: string;
      logoUri?: string;
    }
  ) => Promise<void>;
  deleteBusiness: (id: string) => Promise<void>;
}

// Clean onboarding placeholder when no business is registered yet
const PLACEHOLDER_BUSINESS: Business = {
  id: '0',
  name: 'Register Your Shop',
  category: 'General Retail',
  address: 'Complete onboarding setup',
  phone: '',
  logoUri: '',
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
          useAuthStore.getState().setActiveBusinessId(id);
        }
      },
      loadBusinessesFromDb: async () => {
        try {
          // 1. Wait for Auth hydration to finish from AsyncStorage
          if (!useAuthStore.persist.hasHydrated()) {
            console.log('Skipping business load: AuthStore not hydrated yet');
            return;
          }

          const loggedInPhone = useAuthStore.getState().userPhone;
          if (!loggedInPhone) {
            // Only reset to placeholder if the user is explicitly logged out
            if (!useAuthStore.getState().isLoggedIn) {
              set({
                businesses: DEFAULT_BUSINESSES,
                activeBusiness: DEFAULT_BUSINESSES[0],
              });
            }
            return;
          }

          // If online, fetch user businesses from remote Supabase and upsert them locally
          try {
            const { data, error } = await supabase.rpc('fetch_user_businesses');
            if (!error && data) {
              const { businesses: remoteBizs = [], employees: remoteEmps = [] } = data;
              await database.write(async () => {
                // Upsert businesses
                for (const b of remoteBizs) {
                  const localBizs = await database
                    .get('businesses')
                    .query(Q.where('id', b.id))
                    .fetch();
                  if (localBizs.length > 0) {
                    await localBizs[0].update((biz: any) => {
                      biz._raw._status = 'synced';
                      biz._raw._changed = '';
                      biz.name = b.name;
                      biz.businessType = b.business_type;
                      biz.address = b.address;
                      biz.phoneNumber = b.phone_number;
                      biz.taxId = b.tax_id;
                      biz.operatingHours = b.operating_hours;
                      biz.logoUri = b.logo_uri;
                    });
                  } else {
                    await database.get('businesses').create((biz: any) => {
                      biz._raw.id = b.id;
                      biz._raw._status = 'synced';
                      biz._raw._changed = '';
                      biz.name = b.name;
                      biz.businessType = b.business_type;
                      biz.address = b.address;
                      biz.phoneNumber = b.phone_number;
                      biz.taxId = b.tax_id;
                      biz.operatingHours = b.operating_hours;
                      biz.logoUri = b.logo_uri;
                    });
                  }
                }

                // Upsert employees
                for (const emp of remoteEmps) {
                  const localEmps = await database
                    .get('employees')
                    .query(Q.where('id', emp.id))
                    .fetch();
                  const bizRecord = await database
                    .get('businesses')
                    .query(Q.where('id', emp.business_id))
                    .fetch();
                  if (localEmps.length > 0) {
                    await localEmps[0].update((e: any) => {
                      e._raw._status = 'synced';
                      e._raw._changed = '';
                      e.name = emp.name;
                      e.role = emp.role;
                      e.phone = emp.phone;
                      e.email = emp.email;
                      if (bizRecord.length > 0) {
                        e.business.set(bizRecord[0]);
                      }
                    });
                  } else {
                    await database.get('employees').create((e: any) => {
                      e._raw.id = emp.id;
                      e._raw._status = 'synced';
                      e._raw._changed = '';
                      e.name = emp.name;
                      e.role = emp.role;
                      e.phone = emp.phone;
                      e.email = emp.email;
                      if (bizRecord.length > 0) {
                        e.business.set(bizRecord[0]);
                      }
                    });
                  }
                }
              });
            }
          } catch (rpcErr) {
            console.warn('Failed to sync remote user businesses:', rpcErr);
          }

          const normalizePhone = (phoneStr: string): string => {
            let cleaned = phoneStr.replace(/\D/g, '');
            if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
            if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
            return cleaned;
          };

          const cleanLoggedInPhone = normalizePhone(loggedInPhone);
          const matchedBusinessesMap = new Map<string, any>();

          // 1. Fetch businesses where the logged-in user is a registered staff member (Employee)
          const allEmployees = await database.get('employees').query().fetch();
          const matchedEmployees = allEmployees.filter((emp: any) => {
            return normalizePhone(emp.phone || '') === cleanLoggedInPhone;
          });

          for (const emp of matchedEmployees) {
            const biz = await (emp as any).business.fetch();
            if (biz) {
              matchedBusinessesMap.set(biz.id, biz);
            }
          }

          // 2. Fetch businesses owned directly by the logged-in user phone number
          const allBusinesses = await database.get('businesses').query().fetch();
          const matchedOwned = allBusinesses.filter((b: any) => {
            return normalizePhone(b.phoneNumber || '') === cleanLoggedInPhone;
          });

          for (const biz of matchedOwned) {
            matchedBusinessesMap.set(biz.id, biz);
          }

          const uniqueBusinesses = Array.from(matchedBusinessesMap.values());

          const list: Business[] = uniqueBusinesses.map((b: any) => ({
            id: b.id,
            name: b.name,
            category: b.businessType,
            address: b.address || 'No Address Provided',
            phone: b.phoneNumber || '+94 ** *** ****',
            logoUri: b.logoUri || '',
          }));

          // Determine target business to activate
          const targetBizId = useAuthStore.getState().activeBusinessId || get().activeBusiness.id;

          if (list.length > 0) {
            const selectedBiz = list.find((b) => b.id === targetBizId) || list[0];
            set({
              businesses: list,
              activeBusiness: selectedBiz,
            });
            useAuthStore.getState().setActiveBusinessId(selectedBiz.id);
          } else {
            set({
              businesses: [PLACEHOLDER_BUSINESS],
              activeBusiness: PLACEHOLDER_BUSINESS,
            });
            useAuthStore.getState().setActiveBusinessId(null);
          }
        } catch (err) {
          console.error('Failed to load businesses from SQLite:', err);
        }
      },
      registerBusiness: async (name, address, phone, category = 'General Retail') => {
        try {
          let newBusinessRecord: any;
          await database.write(async () => {
            newBusinessRecord = await database.get('businesses').create((biz: any) => {
              biz.name = name;
              biz.businessType = category;
              biz.address = address;
              biz.phoneNumber = phone;
            });

            await database.get('employees').create((emp: any) => {
              emp.business.set(newBusinessRecord);
              emp.name = 'Owner / Admin';
              emp.role = 'admin';
              emp.phone = phone;
            });
          });
          console.log('Successfully saved business and admin employee to local database');

          // Seed products ONLY for the very first registered store in SQLite!
          const dbBizs = await database.get('businesses').query().fetch();
          if (dbBizs.length === 1) {
            console.log(
              'First brand business registered. Seeding dynamic inventory catalog in SQLite...'
            );
            const existingProducts = await database.get('products').query().fetch();
            if (existingProducts.length === 0) {
              // Use centralized seed data to avoid duplication and 404-prone image links
              await database.write(async () => {
                for (const item of SEEDING_PRODUCTS) {
                  await database.get('products').create((p: any) => {
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
              console.log(
                'Successfully seeded catalog products for the first registered business!'
              );
            }
          }

          await get().loadBusinessesFromDb();

          if (newBusinessRecord) {
            const found = get().businesses.find((b) => b.name === name);
            if (found) {
              set({ activeBusiness: found });
              useAuthStore.getState().setActiveBusinessId(found.id);
            }
          }
        } catch (err) {
          console.error('Failed to write business/employee to local database:', err);
        }
      },
      updateActiveBusinessDetails: async (details) => {
        const activeBiz = get().activeBusiness;

        try {
          const businesses = await database
            .get('businesses')
            .query(Q.where('id', activeBiz.id))
            .fetch();
          if (businesses.length > 0) {
            const targetBiz = businesses[0];
            await database.write(async () => {
              await targetBiz.update((b: any) => {
                b.name = details.name;
                b.businessType = details.category;
                b.address = details.address;
                b.phoneNumber = details.phone;
                if (details.logoUri !== undefined) {
                  b.logoUri = details.logoUri;
                }
              });
            });
            console.log('Successfully updated business details in local WatermelonDB database');
          } else {
            await database.write(async () => {
              await database.get('businesses').create((b: any) => {
                b.name = details.name;
                b.businessType = details.category;
                b.address = details.address;
                b.phoneNumber = details.phone;
                b.logoUri = details.logoUri || '';
              });
            });
            console.log('Successfully created business details in local WatermelonDB database');
          }

          await get().loadBusinessesFromDb();
        } catch (err) {
          console.error('Failed to update business details in WatermelonDB:', err);
        }
      },
      updateBusinessDetails: async (id, details) => {
        try {
          const businesses = await database.get('businesses').query(Q.where('id', id)).fetch();
          if (businesses.length > 0) {
            const targetBiz = businesses[0];
            await database.write(async () => {
              await targetBiz.update((b: any) => {
                b.name = details.name;
                b.businessType = details.category;
                b.address = details.address;
                b.phoneNumber = details.phone;
                if (details.logoUri !== undefined) {
                  b.logoUri = details.logoUri;
                }
              });
            });
            console.log('Successfully updated business details in local WatermelonDB database');
          }
          await get().loadBusinessesFromDb();
        } catch (err) {
          console.error('Failed to update business details in WatermelonDB:', err);
        }
      },
      deleteBusiness: async (id) => {
        try {
          const businesses = await database.get('businesses').query(Q.where('id', id)).fetch();
          if (businesses.length > 0) {
            const targetBiz = businesses[0];

            // Cascade delete all child items belonging to this business
            const [emps, prods, orders] = await Promise.all([
              database.get('employees').query(Q.where('business_id', id)).fetch(),
              database.get('products').query(Q.where('business_id', id)).fetch(),
              database.get('orders').query(Q.where('business_id', id)).fetch(),
            ]);

            const prodIds = prods.map((p) => p.id);
            const orderIds = orders.map((o) => o.id);

            const [orderItems, invLogs] = await Promise.all([
              orderIds.length > 0
                ? database
                    .get('order_items')
                    .query(Q.where('order_id', Q.oneOf(orderIds)))
                    .fetch()
                : Promise.resolve([]),
              prodIds.length > 0
                ? database
                    .get('inventory_logs')
                    .query(Q.where('product_id', Q.oneOf(prodIds)))
                    .fetch()
                : Promise.resolve([]),
            ]);

            await database.write(async () => {
              for (const item of orderItems) await (item as any).markAsDeleted();
              for (const log of invLogs) await (log as any).markAsDeleted();
              for (const order of orders) await (order as any).markAsDeleted();
              for (const prod of prods) await (prod as any).markAsDeleted();
              for (const emp of emps) await (emp as any).markAsDeleted();
              await targetBiz.markAsDeleted();
            });
            console.log('Successfully marked business and all child records as deleted');

            // Trigger sync so deletion pushes to Supabase Cloud
            syncDatabase().catch((err) => console.error('Failed to sync business deletion:', err));
          }
          await get().loadBusinessesFromDb();

          if (get().activeBusiness.id === id) {
            const remaining = get().businesses.filter((b) => b.id !== id);
            if (remaining.length > 0) {
              set({ activeBusiness: remaining[0] });
              useAuthStore.getState().setActiveBusinessId(remaining[0].id);
            } else {
              set({ activeBusiness: PLACEHOLDER_BUSINESS });
              useAuthStore.getState().setActiveBusinessId(null);
            }
          }
        } catch (err) {
          console.error('Failed to delete business from WatermelonDB:', err);
        }
      },
    }),
    {
      name: 'business-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
