import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  icon?: string;
  sku?: string;
  stock?: number;
}

export interface Customer {
  name: string;
  phone: string;
}

interface CartState {
  cart: CartItem[];
  customer: Customer | null;
  customCustomers: Customer[];
  addCartItem: (name: string, price: number, icon?: string, sku?: string, stock?: number) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  setCustomer: (customer: Customer | null) => void;
  addCustomCustomer: (customer: Customer) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],
      customer: null,
      customCustomers: [],
      addCartItem: (name, price, icon = '📦', sku, stock = 15) => {
        const currentCart = get().cart;
        const existing = currentCart.find((item) => item.name === name);
        if (existing) {
          set({
            cart: currentCart.map((item) =>
              item.name === name ? { ...item, quantity: item.quantity + 1 } : item
            ),
          });
        } else {
          set({
            cart: [
              ...currentCart,
              {
                id: Date.now().toString(),
                name,
                price,
                quantity: 1,
                icon,
                sku: sku || `SKU ${Math.floor(100000 + Math.random() * 900000)}`,
                stock,
              },
            ],
          });
        }
      },
      updateQuantity: (id, delta) => {
        const currentCart = get().cart;
        set({
          cart: currentCart
            .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
            .filter((item) => item.quantity > 0),
        });
      },
      clearCart: () => set({ cart: [], customer: null }),
      setCustomer: (customer) => set({ customer }),
      addCustomCustomer: (customer) => {
        const current = get().customCustomers || [];
        const exists = current.some(
          (c) => c.name.toLowerCase() === customer.name.toLowerCase() && c.phone === customer.phone
        );
        if (!exists) {
          set({ customCustomers: [...current, customer] });
        }
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
