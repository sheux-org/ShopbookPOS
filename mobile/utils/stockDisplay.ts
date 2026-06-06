export type StockType = 'normal' | 'low' | 'out';

export interface ProductStockSource {
  stockCount: number;
  lowStockAlert?: number;
  stockType: StockType;
  stockText: string;
}

export function buildStockDisplay(
  stockCount: number,
  lowStockAlert = 5
): { stockCount: number; stockType: StockType; stockText: string } {
  const stockType: StockType =
    stockCount === 0 ? 'out' : stockCount <= lowStockAlert ? 'low' : 'normal';
  const stockText =
    stockType === 'out'
      ? 'Out of Stock'
      : stockType === 'low'
        ? `Low · ${stockCount} remaining`
        : `${stockCount} in stock`;
  return { stockCount, stockType, stockText };
}

/** Per-item stock display — only computed for the row being rendered. */
export function getCartAdjustedStock(
  product: ProductStockSource,
  inCartQty: number
): { stockType: StockType; stockText: string } {
  if (inCartQty === 0) {
    return { stockType: product.stockType, stockText: product.stockText };
  }
  const available = Math.max(0, product.stockCount - inCartQty);
  const { stockType, stockText } = buildStockDisplay(available, product.lowStockAlert ?? 5);
  return { stockType, stockText };
}
