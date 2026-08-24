import { Q } from '@nozbe/watermelondb';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import database from '../components/data/db';
import { supabase, syncDatabase } from '../services/sync';
import { useAuthStore } from '../stores/useAuthStore';
import { Business, useBusinessStore } from '../stores/useBusinessStore';
import { SEEDING_PRODUCTS } from '../utils/seedProducts';
import { checkPhoneAvailability, normalizePhone } from '../utils/phoneUtils';

// Onboarding placeholder when no business is registered yet
const PLACEHOLDER_BUSINESS: Business = {
  id: '0',
  name: 'Register Your Shop',
  category: 'General Retail',
  address: 'Complete onboarding setup',
  phone: '',
  logoUri: '',
};

export function useBusinesses() {
  const loggedInPhone = useAuthStore((state) => state.userPhone);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return useQuery<Business[]>({
    queryKey: ['businesses', loggedInPhone, isLoggedIn],
    queryFn: async () => {
      if (!isLoggedIn || !loggedInPhone) {
        return [PLACEHOLDER_BUSINESS];
      }

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

      if (uniqueBusinesses.length === 0) {
        return [PLACEHOLDER_BUSINESS];
      }

      const list: Business[] = uniqueBusinesses.map((b: any) => ({
        id: b.id,
        name: b.name,
        category: b.businessType,
        address: b.address || 'No Address Provided',
        phone: b.phoneNumber || '+94 ** *** ****',
        logoUri: b.logoUri || '',
      }));

      // Synchronize back to the business store list for backward compatibility
      useBusinessStore.setState({ businesses: list });

      // Keep the active business in sync with fresh database updates in real-time
      const currentActive = useBusinessStore.getState().activeBusiness;
      const targetBizId = useAuthStore.getState().activeBusinessId || currentActive.id;
      const selectedBiz =
        list.find((b) => b.id === targetBizId) ||
        list.find((b) => b.id === currentActive.id) ||
        list[0];
      if (selectedBiz) {
        useBusinessStore.setState({ activeBusiness: selectedBiz });
      }

      return list;
    },
  });
}

export function useRegisterBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      address: string;
      phone: string;
      category?: string;
    }) => {
      const { name, address, phone, category = 'General Retail' } = params;
      const cleanPhone = normalizePhone(phone);

      if (!cleanPhone || cleanPhone.length < 9) {
        throw new Error('Please enter a valid phone number.');
      }

      // Check phone uniqueness locally and in Cloud
      const phoneCheck = await checkPhoneAvailability({
        phone: cleanPhone,
        database,
        supabase,
      });

      if (phoneCheck.isRegistered) {
        throw new Error('This phone number is already registered.');
      }

      let newBusinessRecord: any;
      await database.write(async () => {
        newBusinessRecord = await database.get('businesses').create((biz: any) => {
          biz.name = name;
          biz.businessType = category;
          biz.address = address;
          biz.phoneNumber = cleanPhone;
        });

        await database.get('employees').create((emp: any) => {
          emp.business.set(newBusinessRecord);
          emp.name = 'Owner / Admin';
          emp.role = 'admin';
          emp.phone = cleanPhone;
        });
      });

      // Seed products ONLY for the very first registered store in SQLite!
      const dbBizs = await database.get('businesses').query().fetch();
      if (dbBizs.length === 1) {
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
      }

      return {
        id: newBusinessRecord.id,
        name,
        category,
        address,
        phone: cleanPhone,
        logoUri: '',
      };
    },
    onSuccess: (newBiz) => {
      // Invalidate businesses query cache so all components refetch instantly!
      queryClient.invalidateQueries({ queryKey: ['businesses'] });

      useBusinessStore.getState().setActiveBusiness(newBiz.id);
      useAuthStore.getState().setActiveBusinessId(newBiz.id);

      // Trigger automatic background sync to Supabase without blocking the UX
      syncDatabase()
        .then((synced: boolean) => {
          if (synced) {
            console.log('Background sync successfully pushed new business to Supabase.');
          }
        })
        .catch((err: any) => {
          console.error('Background auto-sync failed:', err);
        });
    },
  });
}

export function useUpdateActiveBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (details: {
      name: string;
      category: string;
      address: string;
      phone: string;
      logoUri?: string;
    }) => {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      const cleanPhone = normalizePhone(details.phone);

      if (cleanPhone) {
        const phoneCheck = await checkPhoneAvailability({
          phone: cleanPhone,
          excludeBusinessId: activeBiz.id,
          database,
          supabase,
        });

        if (phoneCheck.isRegistered) {
          throw new Error('This phone number is already registered.');
        }
      }

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
      } else {
        await database.write(async () => {
          await database.get('businesses').create((b: any) => {
            b.name = details.name;
            b.businessType = details.category;
            b.address = details.address;
            b.phoneNumber = cleanPhone || details.phone;
            b.logoUri = details.logoUri || '';
          });
        });
      }
      return { id: activeBiz.id, ...details };
    },
    onSuccess: (updatedBiz) => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });

      // Real-time active business synchronization everywhere across all components!
      useBusinessStore.setState({
        activeBusiness: {
          id: updatedBiz.id,
          name: updatedBiz.name,
          category: updatedBiz.category,
          address: updatedBiz.address,
          phone: updatedBiz.phone,
          logoUri: updatedBiz.logoUri,
        },
      });

      // Trigger automatic background sync to Supabase without blocking the UX
      syncDatabase()
        .then((synced: boolean) => {
          if (synced) {
            console.log(
              'Background sync successfully pushed business profile changes to Supabase.'
            );
          }
        })
        .catch((err: any) => {
          console.error('Background auto-sync failed:', err);
        });
    },
  });
}

export function useUpdateBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      details: {
        name: string;
        category: string;
        address: string;
        phone: string;
        logoUri?: string;
      };
    }) => {
      const { id, details } = params;
      const cleanPhone = normalizePhone(details.phone);

      if (cleanPhone) {
        const phoneCheck = await checkPhoneAvailability({
          phone: cleanPhone,
          excludeBusinessId: id,
          database,
          supabase,
        });

        if (phoneCheck.isRegistered) {
          throw new Error('This phone number is already registered.');
        }
      }

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
      return { id, ...details };
    },
    onSuccess: (updatedBiz) => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });

      // Real-time active business synchronization everywhere across all components!
      const currentActive = useBusinessStore.getState().activeBusiness;
      if (currentActive.id === updatedBiz.id) {
        useBusinessStore.setState({
          activeBusiness: {
            id: updatedBiz.id,
            name: updatedBiz.name,
            category: updatedBiz.category,
            address: updatedBiz.address,
            phone: updatedBiz.phone,
            logoUri: updatedBiz.logoUri,
          },
        });
      }

      // Trigger automatic background sync to Supabase without blocking the UX
      syncDatabase()
        .then((synced: boolean) => {
          if (synced) {
            console.log(
              'Background sync successfully pushed business profile changes to Supabase.'
            );
          }
        })
        .catch((err: any) => {
          console.error('Background auto-sync failed:', err);
        });
    },
  });
}

export function useDeleteBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
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
      }
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });

      // Fallback active business if deleted active one
      const currentActive = useBusinessStore.getState().activeBusiness;
      if (currentActive.id === deletedId) {
        const list = useBusinessStore.getState().businesses.filter((b) => b.id !== deletedId);
        if (list.length > 0) {
          useBusinessStore.getState().setActiveBusiness(list[0].id);
        } else {
          useBusinessStore.setState({ activeBusiness: PLACEHOLDER_BUSINESS });
          useAuthStore.getState().setActiveBusinessId(null);
        }
      }

      // Trigger automatic background sync to Supabase without blocking the UX
      syncDatabase()
        .then((synced: boolean) => {
          if (synced) {
            console.log('Background sync successfully pushed business deletion to Supabase.');
          }
        })
        .catch((err: any) => {
          console.error('Background auto-sync failed:', err);
        });
    },
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  let cleanBase64 = base64;
  if (cleanBase64.startsWith('data:')) {
    const commaIndex = cleanBase64.indexOf(',');
    if (commaIndex !== -1) {
      cleanBase64 = cleanBase64.substring(commaIndex + 1);
    }
  }
  cleanBase64 = cleanBase64.replace(/[^A-Za-z0-9+/=]/g, '');

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = cleanBase64.length * 0.75;
  if (cleanBase64[cleanBase64.length - 1] === '=') {
    bufferLength--;
    if (cleanBase64[cleanBase64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let p = 0;
  for (let i = 0; i < cleanBase64.length; i += 4) {
    const base64Part1 = lookup[cleanBase64.charCodeAt(i)];
    const base64Part2 = lookup[cleanBase64.charCodeAt(i + 1)];
    const base64Part3 = lookup[cleanBase64.charCodeAt(i + 2)];
    const base64Part4 = lookup[cleanBase64.charCodeAt(i + 3)];

    bytes[p++] = (base64Part1 << 2) | (base64Part2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((base64Part2 & 15) << 4) | (base64Part3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((base64Part3 & 3) << 6) | (base64Part4 & 63);
    }
  }

  return arrayBuffer;
}

export function useUploadBusinessLogo() {
  return useMutation({
    mutationFn: async (params: { uri: string; base64?: string; businessId: string }) => {
      const { uri, base64, businessId } = params;
      let uploadData: any;
      let contentType = 'image/jpeg';
      const fileExt = uri.split('.').pop() || 'jpg';
      contentType = `image/${fileExt === 'png' ? 'png' : fileExt === 'svg' ? 'svg+xml' : 'jpeg'}`;

      if (base64) {
        uploadData = base64ToArrayBuffer(base64);
      } else {
        const response = await fetch(uri);
        uploadData = await response.blob();
      }

      const fileName = `${businessId}/logo_${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage.from('business-logos').upload(fileName, uploadData, {
        contentType,
        upsert: true,
      });

      if (error) {
        throw error;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('business-logos').getPublicUrl(fileName);

      // Save directly to local WatermelonDB
      const businesses = await database.get('businesses').query(Q.where('id', businessId)).fetch();
      if (businesses.length > 0) {
        const targetBiz = businesses[0];
        await database.write(async () => {
          await targetBiz.update((b: any) => {
            b.logoUri = publicUrl;
          });
        });
      }

      // Update active business in store so all components re-render immediately
      useBusinessStore.setState((state) => {
        if (state.activeBusiness.id === businessId) {
          return {
            activeBusiness: {
              ...state.activeBusiness,
              logoUri: publicUrl,
            },
          };
        }
        return {};
      });

      // Trigger automatic background sync to Supabase without blocking the UX
      try {
        await syncDatabase();
      } catch (syncErr) {
        console.error('Auto sync after logo upload failed:', syncErr);
      }

      return publicUrl;
    },
  });
}
