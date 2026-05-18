import { useCart } from '../../stores/useCart';
import { useBusinessStore, Business } from '../../stores/useBusinessStore';
import { useAuthStore } from '../../stores/useAuthStore';

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
  stockType: "normal" | "low" | "out";
  stockCount: number;
  unitType?: string;
  costPrice?: number;
  quickCode?: string;
  barcode?: string;
}

export type { Business };

export const cartState = {
  // Cart Actions mapped cleanly to useCart store
  getCart: () => useCart.getState().cart,
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
  register: async (name: string, address: string, phone: string, category: string = "General Retail") => {
    await useBusinessStore.getState().registerBusiness(name, address, phone, category);
  },
  updateActiveBusinessDetails: async (details: { name: string; category: string; address: string; phone: string }) => {
    await useBusinessStore.getState().updateActiveBusinessDetails(details);
  },

  // Auth Actions mapped cleanly to useAuthStore store
  getIsLoggedIn: () => useAuthStore.getState().isLoggedIn,
  login: (phone: string, otp: string): boolean => {
    return useAuthStore.getState().login(phone, otp);
  },
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
  addNewCatalogProduct: async (product: Omit<CatalogProduct, "id" | "stockText" | "stockType">) => {
    try {
      const db = require('./db').default;
      const { Q } = require('@nozbe/watermelondb');
      await db.write(async () => {
        const activeBiz = useBusinessStore.getState().activeBusiness;
        let dbBiz;
        const businesses = await db.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
        if (businesses.length > 0) {
          dbBiz = businesses[0];
        } else {
          dbBiz = await db.get('businesses').create((b: any) => {
            b.name = activeBiz.name;
            b.businessType = activeBiz.category;
            b.address = activeBiz.address;
            b.phoneNumber = activeBiz.phone;
          });
        }

        await db.get('products').create((p: any) => {
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
        });
      });
      console.log('Successfully saved new catalog product to WatermelonDB database');
    } catch (err) {
      console.error('Failed to write new catalog product to WatermelonDB:', err);
    }
  },
};

// Private seeding logic for populating local WatermelonDB database when empty on initial setup
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

setTimeout(async () => {
  try {
    const db = require('./db').default;
    const existing = await db.get('products').query().fetch();
    if (existing.length === 0) {
      console.log('WatermelonDB products table is empty. Seeding initial catalog...');
      const activeBiz = useBusinessStore.getState().activeBusiness;
      
      await db.write(async () => {
        const dbBiz = await db.get('businesses').create((b: any) => {
          b.name = activeBiz.name;
          b.businessType = activeBiz.category;
          b.address = activeBiz.address;
          b.phoneNumber = activeBiz.phone;
        });

        for (const item of SEEDING_PRODUCTS) {
          await db.get('products').create((p: any) => {
            p.business.set(dbBiz);
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
      console.log('Successfully seeded WatermelonDB with initial mock products');
    }
  } catch (err) {
    console.error('Failed to seed WatermelonDB initial products:', err);
  }
}, 1000);
