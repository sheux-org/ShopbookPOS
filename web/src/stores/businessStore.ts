import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Q } from '@nozbe/watermelondb';
import database from '../db/database';
import { SEEDING_PRODUCTS } from '../utils/seedProducts';
import { useAuthStore } from './authStore';
import { syncDatabase, supabase } from '../services/sync';
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
    category?: string,
    logoUri?: string
  ) => Promise<string | undefined>;
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
        if (typeof window === 'undefined') return;
        try {
          if (!useAuthStore.persist.hasHydrated()) {
            console.log('Skipping business load: AuthStore not hydrated yet');
            return;
          }

          const loggedInPhone = useAuthStore.getState().userPhone;
          if (!loggedInPhone) {
            if (!useAuthStore.getState().isLoggedIn) {
              set({
                businesses: DEFAULT_BUSINESSES,
                activeBusiness: DEFAULT_BUSINESSES[0],
              });
            }
            return;
          }

          // If online, fetch user businesses from remote Supabase and upsert them locally
          if (navigator.onLine) {
            try {
              const { data, error } = await supabase.rpc('fetch_user_businesses', {
                input_phone: loggedInPhone,
              });
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
          }

          const normalizePhone = (phoneStr: string): string => {
            let cleaned = phoneStr.replace(/\D/g, '');
            if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
            if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
            return cleaned;
          };

          const cleanLoggedInPhone = normalizePhone(loggedInPhone);
          const matchedBusinessesMap = new Map<string, any>();

          // 1. Employees query
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

          // 2. Direct business owner query
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

          const targetBizId = useAuthStore.getState().activeBusinessId || get().activeBusiness.id;

          if (list.length > 0) {
            const selectedBiz = list.find((b) => b.id === targetBizId) || list[0];
            set({
              businesses: list,
              activeBusiness: selectedBiz,
            });
          } else {
            set({
              businesses: [PLACEHOLDER_BUSINESS],
              activeBusiness: PLACEHOLDER_BUSINESS,
            });
          }
        } catch (err) {
          console.error('Failed to load businesses from IndexedDB:', err);
        }
      },
      registerBusiness: async (name, address, phone, category = 'General Retail', logoUri = '') => {
        try {
          const cleanPhone = normalizePhone(phone);
          if (cleanPhone && cleanPhone.length >= 9) {
            const phoneCheck = await checkPhoneAvailability({
              phone: cleanPhone,
              database,
              supabase,
            });
            if (phoneCheck.isRegistered) {
              console.warn('Cannot register business: Phone number is already registered.');
              throw new Error('This phone number is already registered.');
            }
          }

          let newBusinessRecord: any;
          await database.write(async () => {
            newBusinessRecord = await database.get('businesses').create((biz: any) => {
              biz.name = name;
              biz.businessType = category;
              biz.address = address;
              biz.phoneNumber = cleanPhone || phone;
              biz.logoUri = logoUri;
            });

            await database.get('employees').create((emp: any) => {
              emp.business.set(newBusinessRecord);
              emp.name = 'Owner / Admin';
              emp.role = 'admin';
              emp.phone = cleanPhone || phone;
            });
          });

          // Seed catalog products for first registered store
          const dbBizs = await database.get('businesses').query().fetch();
          if (dbBizs.length === 1) {
            const existingProducts = await database.get('products').query().fetch();
            if (existingProducts.length === 0) {
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
            }
          }

          await get().loadBusinessesFromDb();

          if (newBusinessRecord) {
            get().setActiveBusiness(newBusinessRecord.id);
          }

          syncDatabase(); // Trigger real-time background replication
          return newBusinessRecord?.id;
        } catch (err) {
          console.error('Failed to register business to IndexedDB:', err);
          return undefined;
        }
      },
      updateActiveBusinessDetails: async (details) => {
        const activeBiz = get().activeBusiness;
        const cleanPhone = normalizePhone(details.phone);
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
                b.phoneNumber = cleanPhone || details.phone;
                if (details.logoUri !== undefined) {
                  b.logoUri = details.logoUri;
                }
              });
            });
          }
          await get().loadBusinessesFromDb();
          syncDatabase(); // Trigger real-time background replication
        } catch (err) {
          console.error('Failed to update active business in IndexedDB:', err);
        }
      },
      updateBusinessDetails: async (id, details) => {
        const cleanPhone = normalizePhone(details.phone);
        try {
          const businesses = await database.get('businesses').query(Q.where('id', id)).fetch();
          if (businesses.length > 0) {
            const targetBiz = businesses[0];
            await database.write(async () => {
              await targetBiz.update((b: any) => {
                b.name = details.name;
                b.businessType = details.category;
                b.address = details.address;
                b.phoneNumber = cleanPhone || details.phone;
                if (details.logoUri !== undefined) {
                  b.logoUri = details.logoUri;
                }
              });
            });
          }
          await get().loadBusinessesFromDb();
          syncDatabase(); // Trigger real-time background replication
        } catch (err) {
          console.error('Failed to update business in IndexedDB:', err);
        }
      },
      deleteBusiness: async (id) => {
        if (id === get().activeBusiness.id) {
          console.warn('Cannot delete the active business.');
          return;
        }
        try {
          const businesses = await database.get('businesses').query(Q.where('id', id)).fetch();
          if (businesses.length > 0) {
            const targetBiz = businesses[0];

            // Cascade delete child items belonging to this business
            const [emps, prods, orders] = await Promise.all([
              database
                .get('employees')
                .query(Q.where('business_id', id))
                .fetch()
                .catch(() => []),
              database
                .get('products')
                .query(Q.where('business_id', id))
                .fetch()
                .catch(() => []),
              database
                .get('orders')
                .query(Q.where('business_id', id))
                .fetch()
                .catch(() => []),
            ]);

            const prodIds = prods.map((p: any) => p.id);
            const orderIds = orders.map((o: any) => o.id);

            const [orderItems, invLogs] = await Promise.all([
              orderIds.length > 0
                ? database
                    .get('order_items')
                    .query(Q.where('order_id', Q.oneOf(orderIds)))
                    .fetch()
                    .catch(() => [])
                : Promise.resolve([]),
              prodIds.length > 0
                ? database
                    .get('inventory_logs')
                    .query(Q.where('product_id', Q.oneOf(prodIds)))
                    .fetch()
                    .catch(() => [])
                : Promise.resolve([]),
            ]);

            await database.write(async () => {
              for (const item of orderItems) {
                if ((item as any).markAsDeleted) await (item as any).markAsDeleted();
                else if ((item as any).destroyPermanently) await (item as any).destroyPermanently();
              }
              for (const log of invLogs) {
                if ((log as any).markAsDeleted) await (log as any).markAsDeleted();
                else if ((log as any).destroyPermanently) await (log as any).destroyPermanently();
              }
              for (const order of orders) {
                if ((order as any).markAsDeleted) await (order as any).markAsDeleted();
                else if ((order as any).destroyPermanently)
                  await (order as any).destroyPermanently();
              }
              for (const prod of prods) {
                if ((prod as any).markAsDeleted) await (prod as any).markAsDeleted();
                else if ((prod as any).destroyPermanently) await (prod as any).destroyPermanently();
              }
              for (const emp of emps) {
                if ((emp as any).markAsDeleted) await (emp as any).markAsDeleted();
                else if ((emp as any).destroyPermanently) await (emp as any).destroyPermanently();
              }
              if ((targetBiz as any).markAsDeleted) {
                await (targetBiz as any).markAsDeleted();
              } else if ((targetBiz as any).destroyPermanently) {
                await (targetBiz as any).destroyPermanently();
              }
            });
          }
          await get().loadBusinessesFromDb();
          syncDatabase(); // Trigger real-time background replication

          if (get().activeBusiness.id === id) {
            const remaining = get().businesses.filter((b) => b.id !== id);
            if (remaining.length > 0) {
              set({ activeBusiness: remaining[0] });
            } else {
              set({ activeBusiness: PLACEHOLDER_BUSINESS });
            }
          }
        } catch (err) {
          console.error('Failed to delete business from IndexedDB:', err);
        }
      },
    }),
    {
      name: 'business-storage',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
    }
  )
);
