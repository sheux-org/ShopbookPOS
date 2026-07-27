import { Q } from '@nozbe/watermelondb';
import { useQuery } from '@tanstack/react-query';
import database from '../components/data/db';

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
  outOfStockCount: number;
  outOfStockItems: any[];
  bestSellers: ProductStat[];
  slowMovers: ProductStat[];
  chartData: { label: string; value: number }[];
  resolvedOrders: any[];
  productsList?: any[];
}

export function useBusinessInsights(
  businessId: string,
  period: 'daily' | 'yesterday' | 'weekly' | 'monthly' | 'yearly' | 'custom',
  resolvedStartDate: Date | null,
  resolvedEndDate: Date | null
) {
  return useQuery<BusinessInsightsData>({
    queryKey: ['insights', businessId, period, resolvedStartDate, resolvedEndDate],
    queryFn: async () => {
      // 1. Fetch active business SQLite record
      const businesses = await database.get('businesses').query(Q.where('id', businessId)).fetch();
      const dbBiz = businesses[0] || (await database.get('businesses').query().fetch())[0];
      if (!dbBiz) {
        return {
          grossRevenue: 0,
          ordersCount: 0,
          avgTicket: 0,
          lowStockCount: 0,
          lowStockItems: [],
          outOfStockCount: 0,
          outOfStockItems: [],
          bestSellers: [],
          slowMovers: [],
          chartData: [],
          resolvedOrders: [],
          productsList: [],
        };
      }

      // 2. Determine time range and fetch completed orders at database level
      const today = new Date();
      let startTs = 0;
      let endTs = Date.now();

      if (period === 'daily') {
        startTs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        endTs = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59,
          999
        ).getTime();
      } else if (period === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        startTs = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate()
        ).getTime();
        endTs = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate(),
          23,
          59,
          59,
          999
        ).getTime();
      } else if (period === 'weekly') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        startTs = sevenDaysAgo.getTime();
        endTs = today.getTime();
      } else if (period === 'monthly') {
        startTs = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
        endTs = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      } else if (period === 'yearly') {
        startTs = new Date(today.getFullYear(), 0, 1).getTime();
        endTs = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
      } else if (period === 'custom' && resolvedStartDate && resolvedEndDate) {
        startTs = new Date(resolvedStartDate).getTime();
        const adjustedEnd = new Date(resolvedEndDate);
        adjustedEnd.setHours(23, 59, 59, 999);
        endTs = adjustedEnd.getTime();
      }

      let ordersQuery = database
        .get('orders')
        .query(Q.where('business_id', dbBiz.id), Q.where('status', 'paid'));

      if (period) {
        ordersQuery = ordersQuery.extend(Q.where('created_at', Q.between(startTs, endTs)));
      }

      const filteredOrders = await ordersQuery.fetch();

      // 4. Fetch all active business products and separate low stock and out of stock items
      const allBizProducts = await database
        .get('products')
        .query(Q.where('business_id', dbBiz.id))
        .fetch();

      const lowStockProducts = allBizProducts.filter((p: any) => {
        const stockCount = p.stockCount ?? 0;
        const threshold = p.lowStockAlert ?? 5;
        return stockCount <= threshold && stockCount > 0;
      });

      const lowStockItems = lowStockProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || 'N/A',
        category: p.category || 'General',
        stockCount: p.stockCount ?? 0,
        lowStockAlert: p.lowStockAlert ?? 5,
        icon: p.icon || 'package',
      }));

      const outOfStockProducts = allBizProducts.filter((p: any) => {
        const stockCount = p.stockCount ?? 0;
        return stockCount <= 0;
      });

      const outOfStockItems = outOfStockProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || 'N/A',
        category: p.category || 'General',
        stockCount: p.stockCount ?? 0,
        lowStockAlert: p.lowStockAlert ?? 5,
        icon: p.icon || 'package',
      }));

      // 5. Gather order items details
      let totalRevenue = 0;
      const productSalesMap: Record<string, { quantity: number; revenue: number }> = {};
      const itemsByOrderMap: Record<string, any[]> = {};

      if (filteredOrders.length > 0) {
        const orderIds = filteredOrders.map((o: any) => o.id);
        const orderItems = await database
          .get('order_items')
          .query(Q.where('order_id', Q.oneOf(orderIds)))
          .fetch();

        for (const order of filteredOrders as any[]) {
          totalRevenue += (order as any).totalAmount ?? 0;
        }

        for (const item of orderItems as any[]) {
          const qty = (item as any).quantity || 0;
          const price = (item as any).price || 0;
          const cost = qty * price;

          const itemName = (item as any).name || 'Unknown';
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
        paymentMethod: order.paymentMethod,
      }));

      // 6. Format product lists
      const salesList: ProductStat[] = Object.keys(productSalesMap).map((name) => ({
        name,
        quantity: productSalesMap[name].quantity,
        revenue: productSalesMap[name].revenue,
      }));

      const bestSellers = [...salesList].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
      const slowMovers = [...salesList].sort((a, b) => a.quantity - b.quantity).slice(0, 5);

      // Generate dynamic sales distribution chart data
      let chartData: { label: string; value: number }[] = [];

      if (period === 'daily' || period === 'yesterday') {
        const hourSales: Record<string, number> = {
          '06:00': 0,
          '09:00': 0,
          '12:00': 0,
          '15:00': 0,
          '18:00': 0,
          '21:00': 0,
          '00:00': 0,
        };
        for (const order of filteredOrders as any[]) {
          const date = new Date((order as any).createdAt);
          const hr = date.getHours();
          if (hr >= 3 && hr < 6) hourSales['06:00'] += (order as any).totalAmount ?? 0;
          else if (hr >= 6 && hr < 9) hourSales['09:00'] += (order as any).totalAmount ?? 0;
          else if (hr >= 9 && hr < 12) hourSales['12:00'] += (order as any).totalAmount ?? 0;
          else if (hr >= 12 && hr < 15) hourSales['15:00'] += (order as any).totalAmount ?? 0;
          else if (hr >= 15 && hr < 18) hourSales['18:00'] += (order as any).totalAmount ?? 0;
          else if (hr >= 18 && hr < 21) hourSales['21:00'] += (order as any).totalAmount ?? 0;
          else hourSales['00:00'] += (order as any).totalAmount ?? 0;
        }
        chartData = Object.keys(hourSales).map((label) => ({
          label,
          value: hourSales[label],
        }));
      } else if (period === 'weekly') {
        const daySales: Record<string, number> = {
          Mon: 0,
          Tue: 0,
          Wed: 0,
          Thu: 0,
          Fri: 0,
          Sat: 0,
          Sun: 0,
        };
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (const order of filteredOrders as any[]) {
          const dStr = days[new Date((order as any).createdAt).getDay()];
          if (daySales[dStr] !== undefined) {
            daySales[dStr] += (order as any).totalAmount ?? 0;
          }
        }
        chartData = Object.keys(daySales).map((label) => ({
          label,
          value: daySales[label],
        }));
      } else if (period === 'monthly') {
        const weekSales: Record<string, number> = {
          'Wk 1': 0,
          'Wk 2': 0,
          'Wk 3': 0,
          'Wk 4': 0,
          'Wk 5': 0,
        };
        for (const order of filteredOrders as any[]) {
          const dayOfMonth = new Date((order as any).createdAt).getDate();
          if (dayOfMonth <= 7) weekSales['Wk 1'] += (order as any).totalAmount ?? 0;
          else if (dayOfMonth <= 14) weekSales['Wk 2'] += (order as any).totalAmount ?? 0;
          else if (dayOfMonth <= 21) weekSales['Wk 3'] += (order as any).totalAmount ?? 0;
          else if (dayOfMonth <= 28) weekSales['Wk 4'] += (order as any).totalAmount ?? 0;
          else weekSales['Wk 5'] += (order as any).totalAmount ?? 0;
        }
        chartData = Object.keys(weekSales).map((label) => ({
          label,
          value: weekSales[label],
        }));
      } else if (period === 'yearly') {
        const monthSales: Record<string, number> = {
          Jan: 0,
          Feb: 0,
          Mar: 0,
          Apr: 0,
          May: 0,
          Jun: 0,
          Jul: 0,
          Aug: 0,
          Sep: 0,
          Oct: 0,
          Nov: 0,
          Dec: 0,
        };
        const months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        for (const order of filteredOrders as any[]) {
          const mStr = months[new Date((order as any).createdAt).getMonth()];
          if (monthSales[mStr] !== undefined) {
            monthSales[mStr] += (order as any).totalAmount ?? 0;
          }
        }
        chartData = Object.keys(monthSales).map((label) => ({
          label,
          value: monthSales[label],
        }));
      } else {
        const customSales: Record<string, number> = {};
        for (const order of filteredOrders as any[]) {
          const dateStr = new Date((order as any).createdAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          });
          if (customSales[dateStr] === undefined) {
            customSales[dateStr] = 0;
          }
          customSales[dateStr] += (order as any).totalAmount ?? 0;
        }
        chartData = Object.keys(customSales).map((label) => ({
          label,
          value: customSales[label],
        }));
        chartData = chartData.slice(0, 15);
      }

      return {
        grossRevenue: totalRevenue,
        ordersCount: filteredOrders.length,
        avgTicket: filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0,
        lowStockCount: lowStockProducts.length,
        lowStockItems,
        outOfStockCount: outOfStockProducts.length,
        outOfStockItems,
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
    fetchReportData: async (period?: string, startDate?: Date | null, endDate?: Date | null) => {
      // 1. Fetch active business SQLite record
      const businesses = await database.get('businesses').query(Q.where('id', businessId)).fetch();
      const dbBiz = businesses[0];
      if (!dbBiz) {
        throw new Error('Active business not found in local database!');
      }

      // 2. Determine time range and fetch completed orders at database level
      const today = new Date();
      let startTs = 0;
      let endTs = Date.now();

      if (period === 'daily') {
        startTs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        endTs = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59,
          999
        ).getTime();
      } else if (period === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        startTs = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate()
        ).getTime();
        endTs = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate(),
          23,
          59,
          59,
          999
        ).getTime();
      } else if (period === 'weekly') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        startTs = sevenDaysAgo.getTime();
        endTs = today.getTime();
      } else if (period === 'monthly') {
        startTs = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
        endTs = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      } else if (period === 'yearly') {
        startTs = new Date(today.getFullYear(), 0, 1).getTime();
        endTs = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
      } else if (period === 'custom' && startDate && endDate) {
        startTs = new Date(startDate).getTime();
        const adjustedEnd = new Date(endDate);
        adjustedEnd.setHours(23, 59, 59, 999);
        endTs = adjustedEnd.getTime();
      }

      let ordersQuery = database
        .get('orders')
        .query(Q.where('business_id', dbBiz.id), Q.where('status', 'paid'));

      if (period) {
        ordersQuery = ordersQuery.extend(Q.where('created_at', Q.between(startTs, endTs)));
      }

      const filteredOrders = await ordersQuery.fetch();

      // 3. Gather all order items for these orders
      let orderItems: any[] = [];
      if (filteredOrders.length > 0) {
        const orderIds = filteredOrders.map((o: any) => o.id);
        const chunkSize = 100;
        for (let i = 0; i < orderIds.length; i += chunkSize) {
          const chunk = orderIds.slice(i, i + chunkSize);
          const itemsChunk = await database
            .get('order_items')
            .query(Q.where('order_id', Q.oneOf(chunk)))
            .fetch();
          orderItems = [...orderItems, ...itemsChunk];
        }
      }

      // 4. Fetch all active business products
      const products = await database
        .get('products')
        .query(Q.where('business_id', dbBiz.id))
        .fetch();

      return {
        business: dbBiz,
        orders: filteredOrders,
        orderItems,
        products,
      };
    },
  };
}
