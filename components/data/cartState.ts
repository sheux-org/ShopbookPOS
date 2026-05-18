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
}

let cartItems: CartItem[] = [
  { id: "1", name: "Anchor Milk 1L", quantity: 2, price: 680, icon: "🥛", sku: "SKU 234001", stock: 24 },
  { id: "2", name: "Marie Biscuits", quantity: 3, price: 180, icon: "🍪", sku: "SKU 234002", stock: 4 },
  { id: "3", name: "Cream Soda 1.5L", quantity: 2, price: 320, icon: "🥤", sku: "SKU 234003", stock: 22 },
];

let catalogProducts: CatalogProduct[] = [
  { id: "1", name: "Anchor Milk 1L", price: 680, category: "dairy", icon: "🥛", stockText: "24 in stock", stockType: "normal", stockCount: 24, unitType: "Liters", costPrice: 580 },
  { id: "2", name: "Highland Yogurt", price: 95, category: "dairy", icon: "🥣", stockText: "38 in stock", stockType: "normal", stockCount: 38, unitType: "Pieces", costPrice: 75 },
  { id: "3", name: "Marie Biscuits", price: 180, category: "snacks", icon: "🍪", stockText: "Low · 4 remaining", stockType: "low", stockCount: 4, unitType: "Packets", costPrice: 140 },
  { id: "4", name: "Lemon Puff 200g", price: 250, category: "snacks", icon: "🥮", stockText: "16 in stock", stockType: "normal", stockCount: 16, unitType: "Packets", costPrice: 200 },
  { id: "5", name: "Cream Soda 1.5L", price: 320, category: "drinks", icon: "🥤", stockText: "22 in stock", stockType: "normal", stockCount: 22, unitType: "Liters", costPrice: 260 },
  { id: "6", name: "Pepsi 1L", price: 280, category: "drinks", icon: "🥤", stockText: "Out of Stock", stockType: "out", stockCount: 0, unitType: "Liters", costPrice: 220 },
  { id: "7", name: "Sunlight Soap", price: 130, category: "grocery", icon: "🧼", stockText: "15 in stock", stockType: "normal", stockCount: 15, unitType: "Pieces", costPrice: 100 },
  { id: "8", name: "Red Rice 1kg", price: 280, category: "grocery", icon: "🌾", stockText: "18 in stock", stockType: "normal", stockCount: 18, unitType: "kg", costPrice: 230 },
  { id: "9", name: "Ceylon Tea", price: 450, category: "drinks", icon: "☕", stockText: "Low · 2 remaining", stockType: "low", stockCount: 2, unitType: "Packets", costPrice: 380 },
  { id: "10", name: "Bread Loaf", price: 110, category: "grocery", icon: "🍞", stockText: "12 in stock", stockType: "normal", stockCount: 12, unitType: "Pieces", costPrice: 85 },
];

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
  getCart: () => cartItems,
  getCatalogProducts: () => catalogProducts,
  getBusinesses: () => BUSINESSES,
  getActiveBusiness: () => activeBusiness,
  setActiveBusiness: (id: string) => {
    const found = BUSINESSES.find((b) => b.id === id);
    if (found) {
      activeBusiness = found;
      listeners.forEach((l) => l());
    }
  },
  getIsLoggedIn: () => loggedIn,
  login: (phone: string, otp: string): boolean => {
    const cleanPhone = phone.replace(/\s+/g, "");
    if (cleanPhone === "0717133074" && otp === "1111") {
      loggedIn = true;
      listeners.forEach((l) => l());
      return true;
    }
    return false;
  },
  register: (name: string, address: string, phone: string, category: string = "General Retail") => {
    // Dynamically create and register a new store/business
    const newId = String(BUSINESSES.length + 1);
    const newBiz: Business = { id: newId, name, category, address, phone };
    BUSINESSES.push(newBiz);
    activeBusiness = newBiz;
    loggedIn = true;
    listeners.forEach((l) => l());
  },
  logout: () => {
    loggedIn = false;
    cartItems = [];
    listeners.forEach((l) => l());
  },
  
  addCartItem: (name: string, price: number, icon?: string, sku?: string, stock?: number) => {
    const existing = cartItems.find((item) => item.name === name);
    if (existing) {
      cartItems = cartItems.map((item) =>
        item.name === name ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      cartItems = [
        ...cartItems,
        {
          id: Date.now().toString(),
          name,
          price,
          quantity: 1,
          icon: icon || "📦",
          sku: sku || `SKU ${Math.floor(100000 + Math.random() * 900000)}`,
          stock: stock !== undefined ? stock : 15,
        },
      ];
    }
    listeners.forEach((l) => l());
  },
  
  updateQuantity: (id: string, delta: number) => {
    cartItems = cartItems
      .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
      .filter((item) => item.quantity > 0);
    listeners.forEach((l) => l());
  },
  
  clearCart: () => {
    cartItems = [];
    listeners.forEach((l) => l());
  },

  addNewCatalogProduct: (product: Omit<CatalogProduct, "id" | "stockText" | "stockType">) => {
    const id = (catalogProducts.length + 1).toString();
    const stockType = product.stockCount === 0 ? "out" : product.stockCount <= 5 ? "low" : "normal";
    const stockText = stockType === "out" ? "Out of Stock" : stockType === "low" ? `Low · ${product.stockCount} remaining` : `${product.stockCount} in stock`;
    
    catalogProducts = [
      ...catalogProducts,
      {
        ...product,
        id,
        stockType,
        stockText,
      } as CatalogProduct,
    ];
    listeners.forEach((l) => l());
  },
  
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
