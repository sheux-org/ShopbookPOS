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

interface CartState {
  cart: CartItem[];
  addCartItem: (name: string, price: number, icon?: string, sku?: string, stock?: number) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],
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
      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
