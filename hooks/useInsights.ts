import { useQuery } from "@tanstack/react-query";
import { Q } from "@nozbe/watermelondb";

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
  chartData: Array<{ label: string; value: number }>;
  resolvedOrders: any[];
  productsList: any[];
}

export function useBusinessInsights(
  businessId: string,
  period: "daily" | "monthly" | "yearly" | "custom",
  resolvedStartDate: Date | null,
  resolvedEndDate: Date | null
) {
  return useQuery<BusinessInsightsData>({
    queryKey: ["insights", businessId, period, resolvedStartDate, resolvedEndDate],
    queryFn: async () => {
      const db = require("../components/data/db").default;

      // 1. Fetch active business SQLite record
      const businesses = await db.get("businesses").query(Q.where("id", businessId)).fetch();
      const dbBiz = businesses[0] || (await db.get("businesses").query().fetch())[0];
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
          productsList: [],
        };
      }

      // 2. Fetch completed orders for active business
      const orders = await db.get("orders").query(
        Q.where("business_id", dbBiz.id),
        Q.where("status", "paid")
      ).fetch();

      // 3. Filter orders in JS based on active period
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
        } else if (period === "custom" && resolvedStartDate && resolvedEndDate) {
          return orderDate >= resolvedStartDate && orderDate <= resolvedEndDate;
        }
        return true;
      });

      // 4. Fetch low stock alert products
      const lowStockProducts = await db.get("products").query(
        Q.where("business_id", dbBiz.id),
        Q.where("stock_count", Q.lte(5))
      ).fetch();

      const lowStockItems = lowStockProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || "N/A",
        category: p.category || "General",
        stockCount: p.stockCount,
        lowStockAlert: p.lowStockAlert || 5,
        icon: p.icon || "package",
      }));

      // 5. Gather order items details
      let totalRevenue = 0;
      const productSalesMap: Record<string, { quantity: number; revenue: number }> = {};
      const itemsByOrderMap: Record<string, any[]> = {};

      if (filteredOrders.length > 0) {
        const orderIds = filteredOrders.map((o: any) => o.id);
        const orderItems = await db.get("order_items").query(
          Q.where("order_id", Q.oneOf(orderIds))
        ).fetch();

        for (const order of filteredOrders) {
          totalRevenue += order.totalAmount;
        }

        for (const item of orderItems) {
          const qty = item.quantity || 0;
          const price = item.price || 0;
          const cost = qty * price;

          if (!productSalesMap[item.name]) {
            productSalesMap[item.name] = { quantity: 0, revenue: 0 };
          }
          productSalesMap[item.name].quantity += qty;
          productSalesMap[item.name].revenue += cost;

          // Map items per order for history drawer
          const orderId = item._raw.order_id;
          if (!itemsByOrderMap[orderId]) {
            itemsByOrderMap[orderId] = [];
          }
          itemsByOrderMap[orderId].push({
            id: item.id,
            name: item.name,
            quantity: qty,
            price: price,
          });
        }
      }

      // 5b. Map resolved orders for history display
      const resolvedOrders = filteredOrders.map((order: any) => ({
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items: itemsByOrderMap[order.id] || [],
      }));

      // 5c. Fetch all products of this business for refill
      const allProducts = await db.get("products").query(
        Q.where("business_id", dbBiz.id)
      ).fetch();

      const productsList = allProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || "N/A",
        category: p.category || "General",
        stockCount: p.stockCount,
        price: p.price,
        icon: p.icon || "📦",
      }));

      // 6. Format product lists
      const salesList: ProductStat[] = Object.keys(productSalesMap).map((name) => ({
        name,
        quantity: productSalesMap[name].quantity,
        revenue: productSalesMap[name].revenue,
      }));

      const bestSellers = [...salesList].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
      const slowMovers = [...salesList].sort((a, b) => a.quantity - b.quantity).slice(0, 5);

      // Generate weekly sales distribution
      const daySales: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      for (const order of filteredOrders) {
        const dStr = days[new Date(order.createdAt).getDay()];
        if (daySales[dStr] !== undefined) {
          daySales[dStr] += order.totalAmount;
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
        productsList,
      };
    },
  });
}
