import { Q } from "@nozbe/watermelondb";
import { useQuery } from "@tanstack/react-query";
import database from "../components/data/db";

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
  productsList?: any[];
}

export function useBusinessInsights(
  businessId: string,
  period: "daily" | "monthly" | "yearly" | "custom",
  resolvedStartDate: Date | null,
  resolvedEndDate: Date | null,
) {
  return useQuery<BusinessInsightsData>({
    queryKey: [
      "insights",
      businessId,
      period,
      resolvedStartDate,
      resolvedEndDate,
    ],
    queryFn: async () => {
      // 1. Fetch active business SQLite record
      const businesses = await database
        .get("businesses")
        .query(Q.where("id", businessId))
        .fetch();
      const dbBiz =
        businesses[0] || (await database.get("businesses").query().fetch())[0];
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
      const orders = await database
        .get("orders")
        .query(Q.where("business_id", dbBiz.id), Q.where("status", "paid"))
        .fetch();

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
        } else if (
          period === "custom" &&
          resolvedStartDate &&
          resolvedEndDate
        ) {
          return orderDate >= resolvedStartDate && orderDate <= resolvedEndDate;
        }
        return true;
      });

      // 4. Fetch all active business products and filter low stock items in JS to support custom thresholds
      const allBizProducts = await database
        .get("products")
        .query(Q.where("business_id", dbBiz.id))
        .fetch();

      const lowStockProducts = allBizProducts.filter((p: any) => {
        const stockCount = p.stockCount ?? 0;
        const threshold = p.lowStockAlert ?? 5;
        return stockCount <= threshold;
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

      // 5. Gather order items details
      let totalRevenue = 0;
      const productSalesMap: Record<
        string,
        { quantity: number; revenue: number }
      > = {};
      const itemsByOrderMap: Record<string, any[]> = {};

      if (filteredOrders.length > 0) {
        const orderIds = filteredOrders.map((o: any) => o.id);
        const orderItems = await database
          .get("order_items")
          .query(Q.where("order_id", Q.oneOf(orderIds)))
          .fetch();

        for (const order of filteredOrders as any[]) {
          totalRevenue += (order as any).totalAmount ?? 0;
        }

        for (const item of orderItems as any[]) {
          const qty = (item as any).quantity || 0;
          const price = (item as any).price || 0;
          const cost = qty * price;

          const itemName = (item as any).name || "Unknown";
          if (!productSalesMap[itemName]) {
            productSalesMap[itemName] = { quantity: 0, revenue: 0 };
          }
          productSalesMap[itemName].quantity += qty;
          productSalesMap[itemName].revenue += cost;

          // Map items per order for history drawer
          const orderId = (item as any)._raw?.order_id;
          if (!itemsByOrderMap[orderId]) {
            itemsByOrderMap[orderId] = [];
          }
          itemsByOrderMap[orderId].push({
            id: (item as any).id,
            name: itemName,
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



      // 6. Format product lists
      const salesList: ProductStat[] = Object.keys(productSalesMap).map(
        (name) => ({
          name,
          quantity: productSalesMap[name].quantity,
          revenue: productSalesMap[name].revenue,
        }),
      );

      const bestSellers = [...salesList]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
      const slowMovers = [...salesList]
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 5);

      // Generate weekly sales distribution
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
        const dStr = days[new Date((order as any).createdAt).getDay()];
        if (daySales[dStr] !== undefined) {
          daySales[dStr] += (order as any).totalAmount ?? 0;
        }
      }

      const chartData = Object.keys(daySales).map((day) => ({
        label: day,
        value: daySales[day],
      }));

      return {
        grossRevenue: totalRevenue,
        ordersCount: filteredOrders.length,
        avgTicket:
          filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0,
        lowStockCount: lowStockProducts.length,
        lowStockItems,
        bestSellers,
        slowMovers,
        chartData,
        resolvedOrders,
      };
    },
  });
}

export function useInsightsExport(businessId: string) {
  return {
    fetchReportData: async () => {
      // 1. Fetch active business SQLite record
      const businesses = await database
        .get("businesses")
        .query(Q.where("id", businessId))
        .fetch();
      const dbBiz = businesses[0];
      if (!dbBiz) {
        throw new Error("Active business not found in local database!");
      }

      // 2. Fetch completed orders for active business (Paid status, all-time)
      const orders = await database
        .get("orders")
        .query(Q.where("business_id", dbBiz.id), Q.where("status", "paid"))
        .fetch();

      // 3. Gather all order items for these orders
      let orderItems: any[] = [];
      if (orders.length > 0) {
        const orderIds = orders.map((o: any) => o.id);
        const chunkSize = 100;
        for (let i = 0; i < orderIds.length; i += chunkSize) {
          const chunk = orderIds.slice(i, i + chunkSize);
          const itemsChunk = await database
            .get("order_items")
            .query(Q.where("order_id", Q.oneOf(chunk)))
            .fetch();
          orderItems = [...orderItems, ...itemsChunk];
        }
      }

      // 4. Fetch all active business products
      const products = await database
        .get("products")
        .query(Q.where("business_id", dbBiz.id))
        .fetch();

      return {
        business: dbBiz,
        orders,
        orderItems,
        products,
      };
    }
  };
}
