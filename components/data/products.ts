export interface Product {
  id: string;
  name: string;
  price: number;
  categories: string[];
  icon: string;
}

export interface RecentItem {
  id: string;
  name: string;
  sku: string;
  price: number;
}

export const CATEGORIES = ["All", "Grocery", "Drinks", "Snacks", "Dairy"];

export const INITIAL_PRODUCTS: Product[] = [
  { id: "1", name: "Anchor Milk 1L", price: 680, categories: ["Dairy", "Grocery", "Drinks"], icon: "🥛" },
  { id: "2", name: "Marie Biscuits", price: 180, categories: ["Snacks", "Grocery"], icon: "🍪" },
  { id: "3", name: "Lemon Puff", price: 250, categories: ["Snacks", "Grocery"], icon: "🥮" },
  { id: "4", name: "Cream Soda 1.5L", price: 320, categories: ["Drinks"], icon: "🥤" },
  { id: "5", name: "Sunlight Soap", price: 130, categories: ["Grocery"], icon: "🧼" },
  { id: "6", name: "Red Rice 1kg", price: 280, categories: ["Grocery"], icon: "🌾" },
  { id: "7", name: "Ceylon Tea", price: 450, categories: ["Drinks", "Grocery"], icon: "☕" },
  { id: "8", name: "Banana 1kg", price: 220, categories: ["Grocery", "Snacks"], icon: "🍌" },
  { id: "9", name: "Chocolate", price: 165, categories: ["Snacks", "Dairy"], icon: "🍫" },
];

export const RECENT_ITEMS: RecentItem[] = [
  { id: "1", name: "Anchor Milk 1L", sku: "SKU 4791234", price: 680 },
  { id: "2", name: "Marie Biscuits", sku: "SKU 4798877", price: 180 },
  { id: "3", name: "Cream Soda 1.5L", sku: "SKU 4795512", price: 320 },
];
