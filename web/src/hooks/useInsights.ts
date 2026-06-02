import { Q } from "@nozbe/watermelondb";
import { useQuery } from "@tanstack/react-query";
import database from "../db/database";

export interface ProductStat {
  name: string;
  quantity: number;
  revenue: number;
}

export interface BusinessInsightsData {
  grossRevenue: number;
  ordersCount: number;
  avgTicket: number;
  lowStockCount: number;
  lowStockItems: any[];
  bestSellers: ProductStat[];
  slowMovers: ProductStat[];
  chartData: { label: string; value: number }[];
  resolvedOrders: any[];
}

export function useBusinessInsights(
  businessId: string,
  period: "daily" | "monthly" | "yearly" | "custom",
  startDate: Date | null,
  endDate: Date | null,
) {
  return useQuery<BusinessInsightsData>({
    queryKey: ["insights", businessId, period, startDate, endDate],
    queryFn: async () => {
      if (!businessId || businessId === "0") {
        return {
          grossRevenue: 0,
          ordersCount: 0,
          avgTicket: 0,
          lowStockCount: 0,
          lowStockItems: [],
          bestSellers: [],
          slowMovers: [],
          chartData: [],
          resolvedOrders: [],
        };
      }

      // 1. Fetch active business
      const businesses = await database
        .get("businesses")
        .query(Q.where("id", businessId))
        .fetch();
      const dbBiz = businesses[0];
      if (!dbBiz) {
        return {
          grossRevenue: 0,
          ordersCount: 0,
          avgTicket: 0,
          lowStockCount: 0,
          lowStockItems: [],
          bestSellers: [],
          slowMovers: [],
          chartData: [],
          resolvedOrders: [],
        };
      }

      // 2. Fetch completed orders
      const orders = await database
        .get("orders")
        .query(Q.where("business_id", dbBiz.id), Q.where("status", "paid"))
        .fetch();

      // 3. Filter orders based on active period
      const filteredOrders = orders.filter((order: any) => {
        const orderDate = new Date(order.createdAt);
        const today = new Date();

        if (period === "daily") {
          return orderDate.toDateString() === today.toDateString();
        } else if (period === "monthly") {
          return (
            orderDate.getMonth() === today.getMonth() &&
            orderDate.getFullYear() === today.getFullYear()
          );
        } else if (period === "yearly") {
          return orderDate.getFullYear() === today.getFullYear();
        } else if (period === "custom" && startDate && endDate) {
          return orderDate >= startDate && orderDate <= endDate;
        }
        return true;
      });

      // 4. Fetch low stock items
      const allProducts = await database
        .get("products")
        .query(Q.where("business_id", dbBiz.id))
        .fetch();

      const lowStockProducts = allProducts.filter((p: any) => {
        const stockCount = p.stockCount ?? 0;
        const threshold = p.lowStockAlert ?? 5;
        return stockCount <= threshold && stockCount > 0;
      });

      const lowStockItems = lowStockProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || "N/A",
        category: p.category || "General",
        stockCount: p.stockCount,
        lowStockAlert: p.lowStockAlert ?? 5,
        icon: p.icon || "package",
      }));

      // 5. Gather order items
      let totalRevenue = 0;
      const productSalesMap: Record<string, { quantity: number; revenue: number }> = {};
      const itemsByOrderMap: Record<string, any[]> = {};

      if (filteredOrders.length > 0) {
        const orderIds = filteredOrders.map((o: any) => o.id);
        const orderItems = await database
          .get("order_items")
          .query(Q.where("order_id", Q.oneOf(orderIds)))
          .fetch();

        for (const order of filteredOrders as any[]) {
          totalRevenue += order.totalAmount ?? 0;
        }

        for (const item of orderItems as any[]) {
          const qty = item.quantity || 0;
          const price = item.price || 0;
          const cost = qty * price;

          const itemName = item.name || "Unknown";
          if (!productSalesMap[itemName]) {
            productSalesMap[itemName] = { quantity: 0, revenue: 0 };
          }
          productSalesMap[itemName].quantity += qty;
          productSalesMap[itemName].revenue += cost;

          const orderId = item._raw?.order_id || item.order_id;
          if (orderId) {
            if (!itemsByOrderMap[orderId]) {
              itemsByOrderMap[orderId] = [];
            }
            itemsByOrderMap[orderId].push({
              id: item.id,
              name: itemName,
              quantity: qty,
              price: price,
            });
          }
        }
      }

      // Map resolved orders for history/ledger display
      const resolvedOrders = filteredOrders.map((order: any) => ({
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod || "cash",
        discountValue: order.discountValue || 0,
        taxValue: order.taxValue || 0,
        createdAt: order.createdAt,
        timestamp: order.createdAt ? new Date(order.createdAt).getTime() : Date.now(),
        date: new Date(order.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }),
        items: itemsByOrderMap[order.id] || [],
      }));

      // Sort resolved orders newest first
      resolvedOrders.sort((a, b) => b.timestamp - a.timestamp);

      // Best sellers and slow movers
      const salesList: ProductStat[] = Object.keys(productSalesMap).map((name) => ({
        name,
        quantity: productSalesMap[name].quantity,
        revenue: productSalesMap[name].revenue,
      }));

      const bestSellers = [...salesList]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
      const slowMovers = [...salesList]
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 5);

      // Generate weekly sales distribution chart data (Sun-Sat)
      const daySales: Record<string, number> = {
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
        Sun: 0,
      };
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      for (const order of filteredOrders as any[]) {
        const dStr = days[new Date(order.createdAt).getDay()];
        if (daySales[dStr] !== undefined) {
          daySales[dStr] += order.totalAmount ?? 0;
        }
      }

      const chartData = Object.keys(daySales).map((day) => ({
        label: day,
        value: daySales[day],
      }));

      return {
        grossRevenue: totalRevenue,
        ordersCount: filteredOrders.length,
        avgTicket: filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0,
        lowStockCount: lowStockProducts.length,
        lowStockItems,
        bestSellers,
        slowMovers,
        chartData,
        resolvedOrders,
      };
    },
    enabled: !!businessId && businessId !== "0",
  });
}
