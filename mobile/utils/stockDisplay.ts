export type StockType = 'normal' | 'low' | 'out';

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
