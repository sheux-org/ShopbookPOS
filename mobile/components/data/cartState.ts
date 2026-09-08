import { Q } from '@nozbe/watermelondb';
import { processUploadQueue } from '../../services/uploadQueue';
import { useAuthStore } from '../../stores/useAuthStore';
import { Business, useBusinessStore } from '../../stores/useBusinessStore';
import { Customer, useCart } from '../../stores/useCart';
import database from './db';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  icon?: string;
  sku?: string;
  stock?: number;
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  stockText: string;
  stockType: 'normal' | 'low' | 'out';
  stockCount: number;
  unitType?: string;
  costPrice?: number;
  quickCode?: string;
  barcode?: string;
  lowStockAlert?: number;
}

export type { Business, Customer };

export const cartState = {
  // Cart Actions mapped cleanly to useCart store
  getCart: () => useCart.getState().cart,
  getCustomer: () => useCart.getState().customer,
  setCustomer: (customer: Customer | null) => {
    useCart.getState().setCustomer(customer);
  },
  addCartItem: (name: string, price: number, icon?: string, sku?: string, stock?: number) => {
    useCart.getState().addCartItem(name, price, icon, sku, stock);
  },
  updateQuantity: (id: string, delta: number) => {
    useCart.getState().updateQuantity(id, delta);
  },
  clearCart: () => {
    useCart.getState().clearCart();
  },

  // Business Actions mapped cleanly to useBusinessStore store
  getBusinesses: () => useBusinessStore.getState().businesses,
  getActiveBusiness: () => useBusinessStore.getState().activeBusiness,
  setActiveBusiness: (id: string) => {
    useBusinessStore.getState().setActiveBusiness(id);
  },
  register: async (
    name: string,
    address: string,
    phone: string,
    category: string = 'General Retail'
  ) => {
    await useBusinessStore.getState().registerBusiness(name, address, phone, category);
  },
  updateActiveBusinessDetails: async (details: {
    name: string;
    category: string;
    address: string;
    phone: string;
  }) => {
    await useBusinessStore.getState().updateActiveBusinessDetails(details);
  },
  updateBusinessDetails: async (
    id: string,
    name: string,
    category: string,
    address: string,
    phone: string
  ) => {
    await useBusinessStore.getState().updateBusinessDetails(id, { name, category, address, phone });
  },
  deleteBusiness: async (id: string) => {
    await useBusinessStore.getState().deleteBusiness(id);
  },

  // Auth Actions mapped cleanly to useAuthStore store
  getIsLoggedIn: () => useAuthStore.getState().isLoggedIn,
  logout: () => {
    useAuthStore.getState().logout();
  },

  // Backward compatibility subscription bridging
  subscribe: (listener: () => void) => {
    const unsubCart = useCart.subscribe(listener);
    const unsubBusiness = useBusinessStore.subscribe(listener);
    const unsubAuth = useAuthStore.subscribe(listener);
    return () => {
      unsubCart();
      unsubBusiness();
      unsubAuth();
    };
  },

  // Direct catalog adding mapped dynamically to local WatermelonDB database
  addNewCatalogProduct: async (product: Omit<CatalogProduct, 'id' | 'stockText' | 'stockType'>) => {
    try {
      await database.write(async () => {
        const activeBiz = useBusinessStore.getState().activeBusiness;
        let dbBiz;
        const businesses = await database
          .get('businesses')
          .query(Q.where('name', activeBiz.name))
          .fetch();
        if (businesses.length > 0) {
          dbBiz = businesses[0];
        } else {
          dbBiz = await database.get('businesses').create((b: any) => {
            b.name = activeBiz.name;
            b.businessType = activeBiz.category;
            b.address = activeBiz.address;
            b.phoneNumber = activeBiz.phone;
          });
        }

        const newProduct = await database.get('products').create((p: any) => {
          p.business.set(dbBiz);
          p.name = product.name;
          p.price = product.price;
          p.category = product.category;
          p.icon = product.icon;
          p.stockCount = product.stockCount;
          p.unitType = product.unitType;
          p.costPrice = product.costPrice;
          p.quickCode = product.quickCode;
          p.barcode = product.barcode;
          p.lowStockAlert = product.lowStockAlert;

          const iconUri = product.icon ?? '';
          const isLocal = iconUri.startsWith('file://') || iconUri.startsWith('/');
          p.iconPendingUpload = isLocal;
        });

        if (product.stockCount > 0) {
          await database.get('inventory_logs').create((log: any) => {
            log.product.set(newProduct);
            log.type = 'in';
            log.quantity = product.stockCount;
            log.reason = 'Initial Stock';
          });
        }
      });
      console.log('Successfully saved new catalog product to WatermelonDB database');

      // Trigger background upload queue process if a local image needs upload
      processUploadQueue();
    } catch (err) {
      console.error('Failed to write new catalog product to WatermelonDB:', err);
    }
  },
};

// Automatically load all store profiles from local SQLite database into memory
setTimeout(async () => {
  try {
    await useBusinessStore.getState().loadBusinessesFromDb();
  } catch (err) {
    console.error('Failed to load store profiles from SQLite on startup:', err);
  }
}, 1000);
