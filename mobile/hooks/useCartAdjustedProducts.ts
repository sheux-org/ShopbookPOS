import { useMemo } from 'react';
import { useCart } from '../stores/useCart';
import { buildStockDisplay } from '../utils/stockDisplay';

type ProductWithStock = {
  name: string;
  stockCount: number;
  lowStockAlert?: number;
  stockType: 'normal' | 'low' | 'out';
  stockText: string;
};

export type CartAdjustedProduct<T extends ProductWithStock> = T & { dbStockCount: number };

export function useCartAdjustedProducts<T extends ProductWithStock>(
  products: T[]
): CartAdjustedProduct<T>[] {
  const cart = useCart((s) => s.cart);

  const qtyByName = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      map[item.name] = (map[item.name] ?? 0) + item.quantity;
    }
    return map;
  }, [cart]);

  return useMemo(() => {
    return products.map((p) => {
      const dbStockCount = p.stockCount;
      const inCart = qtyByName[p.name] ?? 0;
      if (inCart === 0) {
        return { ...p, dbStockCount };
      }
      const available = Math.max(0, dbStockCount - inCart);
      return {
        ...p,
        dbStockCount,
        ...buildStockDisplay(available, p.lowStockAlert ?? 5),
      };
    });
  }, [products, qtyByName]);
}
