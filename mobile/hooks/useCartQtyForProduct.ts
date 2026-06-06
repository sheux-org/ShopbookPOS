import { useCart } from '../stores/useCart';

/** Subscribe to one product's cart qty — other cart changes won't re-render this row. */
export function useCartQtyForProduct(productName: string): number {
  return useCart((s) => {
    let qty = 0;
    for (const item of s.cart) {
      if (item.name === productName) {
        qty += item.quantity;
      }
    }
    return qty;
  });
}
