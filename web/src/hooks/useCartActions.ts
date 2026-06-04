import { useCart, CartItem } from '../stores/cartStore';
import { useBusinessStore } from '../stores/businessStore';
import database from '../db/database';
import { Q } from '@nozbe/watermelondb';
import { useQueryClient } from '@tanstack/react-query';
import { syncDatabase } from '../services/sync';

export function useCartActions() {
  const cart = useCart((s) => s.cart);
  const storeAddCartItem = useCart((s) => s.addCartItem);
  const storeUpdateQuantity = useCart((s) => s.updateQuantity);
  const storeClearCart = useCart((s) => s.clearCart);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const queryClient = useQueryClient();

  const updateProductStockInCache = (productName: string, newStock: number) => {
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.findAll({ queryKey: ['products'] });
    queries.forEach((query) => {
      queryClient.setQueryData(query.queryKey, (oldData: any) => {
        if (!oldData || !oldData.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any[]) =>
            page.map((p) => (p.name === productName ? { ...p, stockCount: newStock } : p))
          ),
        };
      });
    });
  };

  const addCartItem = async (
    name: string,
    price: number,
    icon?: string,
    sku?: string,
    stock?: number,
    triggerToast?: (msg: string) => void
  ) => {
    if (!activeBusiness || activeBusiness.id === '0') return;

    try {
      const dbProducts = await database
        .get('products')
        .query(Q.where('name', name), Q.where('business_id', activeBusiness.id))
        .fetch();

      if (dbProducts.length > 0) {
        const product: any = dbProducts[0];
        if (product.stockCount <= 0) {
          if (triggerToast) triggerToast(`Out of stock: ${name} ⚠️`);
          return;
        }

        await database.write(async () => {
          await product.update((p: any) => {
            p.stockCount = Math.max(0, p.stockCount - 1);
          });
        });

        storeAddCartItem(name, price, icon, sku, product.stockCount);
        updateProductStockInCache(name, product.stockCount);
        syncDatabase();
      }
    } catch (err) {
      console.error('Failed to add cart item:', err);
    }
  };

  const updateQuantity = async (
    id: string,
    delta: number,
    triggerToast?: (msg: string) => void
  ) => {
    if (!activeBusiness || activeBusiness.id === '0') return;

    const item = cart.find((c) => c.id === id);
    if (!item) return;

    try {
      const dbProducts = await database
        .get('products')
        .query(Q.where('name', item.name), Q.where('business_id', activeBusiness.id))
        .fetch();

      if (dbProducts.length > 0) {
        const product: any = dbProducts[0];

        if (delta > 0) {
          if (product.stockCount < delta) {
            if (triggerToast) triggerToast(`Out of stock: ${item.name} ⚠️`);
            return;
          }
          await database.write(async () => {
            await product.update((p: any) => {
              p.stockCount = Math.max(0, p.stockCount - delta);
            });
          });
        } else {
          const amountToRestore = Math.abs(delta);
          await database.write(async () => {
            await product.update((p: any) => {
              p.stockCount = p.stockCount + amountToRestore;
            });
          });
        }

        storeUpdateQuantity(id, delta);
        updateProductStockInCache(product.name, product.stockCount);
        syncDatabase();
      }
    } catch (err) {
      console.error('Failed to update quantity:', err);
    }
  };

  const clearCart = async (restoreStock: boolean = true) => {
    if (!activeBusiness || activeBusiness.id === '0') {
      storeClearCart();
      return;
    }

    try {
      if (restoreStock && cart.length > 0) {
        await database.write(async () => {
          for (const item of cart) {
            const dbProducts = await database
              .get('products')
              .query(Q.where('name', item.name), Q.where('business_id', activeBusiness.id))
              .fetch();

            if (dbProducts.length > 0) {
              const product: any = dbProducts[0];
              await product.update((p: any) => {
                p.stockCount = p.stockCount + item.quantity;
              });
              updateProductStockInCache(product.name, product.stockCount);
            }
          }
        });
        syncDatabase();
      }
    } catch (err) {
      console.error('Failed to clear cart:', err);
    } finally {
      storeClearCart();
    }
  };

  const releaseReservedStocks = async (itemsToRelease: CartItem[], bizIdToRestore: string) => {
    if (!bizIdToRestore || bizIdToRestore === '0' || itemsToRelease.length === 0) {
      storeClearCart();
      return;
    }

    try {
      await database.write(async () => {
        for (const item of itemsToRelease) {
          const dbProducts = await database
            .get('products')
            .query(Q.where('name', item.name), Q.where('business_id', bizIdToRestore))
            .fetch();
          if (dbProducts.length > 0) {
            const product: any = dbProducts[0];
            await product.update((p: any) => {
              p.stockCount = p.stockCount + item.quantity;
            });
            updateProductStockInCache(product.name, product.stockCount);
          }
        }
      });
      storeClearCart();
      syncDatabase();
    } catch (err) {
      console.error('Release reserved stocks failed:', err);
      storeClearCart();
    }
  };

  return {
    cart,
    addCartItem,
    updateQuantity,
    clearCart,
    releaseReservedStocks,
  };
}
