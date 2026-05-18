import { useCart } from '../../stores/useCart';

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

export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
}

const BUSINESSES: Business[] = [
  { id: "1", name: "Shopbook Electronics", category: "Electronics & Gadgets", address: "142 Galle Road, Colombo 03", phone: "+94 11 234 5678" },
  { id: "2", name: "Shopbook Apparel", category: "Clothing & Fashion", address: "88 Peradeniya Road, Kandy", phone: "+94 81 234 5678" },
  { id: "3", name: "Shopbook Groceries", category: "Supermarket & Groceries", address: "55 Main Street, Galle Fort", phone: "+94 91 234 5678" },
];

let activeBusiness: Business = BUSINESSES[0];
let loggedIn: boolean = false;

const listeners = new Set<() => void>();

export const cartState = {
  getCart: () => useCart.getState().cart,
  getBusinesses: () => BUSINESSES,
  getActiveBusiness: () => activeBusiness,
  setActiveBusiness: (id: string) => {
    const found = BUSINESSES.find((b) => b.id === id);
    if (found) {
      activeBusiness = found;
      listeners.forEach((l) => l());
    }
  },
  updateActiveBusinessDetails: async (details: { name: string; category: string; address: string; phone: string }) => {
    activeBusiness = {
      ...activeBusiness,
      ...details,
    };
    
    try {
      const db = require('./db').default;
      const { Q } = require('@nozbe/watermelondb');
      
      const businesses = await db.get('businesses').query(Q.where('phone_number', activeBusiness.phone)).fetch();
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
      listeners.forEach((l) => l());
    } catch (err) {
      console.error('Failed to update business details in WatermelonDB:', err);
    }
  },
  getIsLoggedIn: () => loggedIn,
  login: (phone: string, otp: string): boolean => {
    const cleanPhone = phone.replace(/\s+/g, "");
    if ((cleanPhone === "0717133074" || cleanPhone === "717133074") && otp === "1111") {
      loggedIn = true;
      listeners.forEach((l) => l());
      return true;
    }
    return false;
  },
  register: async (name: string, address: string, phone: string, category: string = "General Retail") => {
    const newId = String(BUSINESSES.length + 1);
    const newBiz: Business = { id: newId, name, category, address, phone };
    BUSINESSES.push(newBiz);
    activeBusiness = newBiz;
    loggedIn = true;
    listeners.forEach((l) => l());

    // Save business & admin employee to local database
    try {
      const db = require('./db').default;
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
  logout: () => {
    loggedIn = false;
    useCart.getState().clearCart();
    listeners.forEach((l) => l());
  },
  
  addCartItem: (name: string, price: number, icon?: string, sku?: string, stock?: number) => {
    useCart.getState().addCartItem(name, price, icon, sku, stock);
    listeners.forEach((l) => l());
  },
  
  updateQuantity: (id: string, delta: number) => {
    useCart.getState().updateQuantity(id, delta);
    listeners.forEach((l) => l());
  },
  
  clearCart: () => {
    useCart.getState().clearCart();
    listeners.forEach((l) => l());
  },

  addNewCatalogProduct: async (product: Omit<CatalogProduct, "id" | "stockText" | "stockType">) => {
    // Save product directly to local SQLite database (WatermelonDB)
    try {
      const db = require('./db').default;
      const { Q } = require('@nozbe/watermelondb');
      await db.write(async () => {
        const activeBiz = cartState.getActiveBusiness();
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
      listeners.forEach((l) => l());
    } catch (err) {
      console.error('Failed to write new catalog product to WatermelonDB:', err);
    }
  },
  
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    const unsubCart = useCart.subscribe(() => {
      listener();
    });
    return () => {
      listeners.delete(listener);
      unsubCart();
    };
  },
};

// Private initial dataset ONLY for seeding the database when empty
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

// Seeding initial catalog products into WatermelonDB if it's empty
setTimeout(async () => {
  try {
    const db = require('./db').default;
    const existing = await db.get('products').query().fetch();
    if (existing.length === 0) {
      console.log('WatermelonDB products table is empty. Seeding initial catalog...');
      const activeBiz = cartState.getActiveBusiness();
      
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
