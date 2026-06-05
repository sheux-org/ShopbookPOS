import { Q } from '@nozbe/watermelondb';
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { cartState } from '../components/data/cartState';
import database from '../components/data/db';
import { useActiveBusiness } from './useActiveBusiness';
import { syncDatabase } from '../services/sync';

export interface DBOrder {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  createdAt: number;
  paymentMethod?: string;
  bankName?: string;
  cardLastFour?: string;
  discountType?: string;
  discountValue?: number;
  taxRate?: number;
  taxValue?: number;
}

export interface DBOrderItem {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  price: number;
}

export function useGetOrders() {
  const activeBiz = useActiveBusiness();
  const PAGE_SIZE = 30;

  const result = useInfiniteQuery<DBOrder[]>({
    queryKey: ['orders', activeBiz.id],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = (pageParam as number) * PAGE_SIZE;
      const query = database
        .get('orders')
        .query(
          Q.where('business_id', activeBiz.id),
          Q.sortBy('created_at', Q.desc),
          Q.skip(offset),
          Q.take(PAGE_SIZE)
        );

      const dbOrders = await query.fetch();
      return dbOrders.map((o: any) => ({
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        totalAmount: o.totalAmount,
        status: o.status,
        createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
        paymentMethod: o.paymentMethod,
        bankName: o.bankName,
        cardLastFour: o.cardLastFour,
        discountType: o.discountType,
        discountValue: o.discountValue,
        taxRate: o.taxRate,
        taxValue: o.taxValue,
      }));
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length < PAGE_SIZE ? undefined : allPages.length;
    },
  });

  const flattenedData = result.data ? result.data.pages.flat() : [];

  return {
    ...result,
    data: flattenedData,
  };
}

export function useGetOrderItems(orderId?: string) {
  return useQuery<DBOrderItem[]>({
    queryKey: ['order_items', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];
      const query = database.get('order_items').query(Q.where('order_id', orderId));

      const dbOrderItems = await query.fetch();
      return dbOrderItems.map((oi: any) => ({
        id: oi.id,
        orderId: orderId,
        name: oi.name,
        quantity: oi.quantity,
        price: oi.price,
      }));
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      totalAmount: number;
      cashierName: string;
      businessId: string;
      paymentMethod?: string;
      bankName?: string;
      cardLastFour?: string;
      discountType?: string;
      discountValue?: number;
      taxRate?: number;
      taxValue?: number;
      cart: {
        name: string;
        price: number;
        quantity: number;
      }[];
    }) => {
      const {
        totalAmount,
        cashierName,
        businessId,
        paymentMethod,
        bankName,
        cardLastFour,
        discountType,
        discountValue,
        taxRate,
        taxValue,
        cart,
      } = params;
      let dbBiz: any;
      const result = await database.write(async () => {
        // Find database business record
        const businesses = await database
          .get('businesses')
          .query(Q.where('id', businessId))
          .fetch();
        dbBiz = businesses[0];
        if (!dbBiz) {
          const allBizs = await database.get('businesses').query().fetch();
          dbBiz = allBizs[0];
        }

        if (!dbBiz) {
          throw new Error('No business record found in SQLite database!');
        }

        const customer = cartState.getCustomer();
        const customerText = customer ? ` | Cust: ${customer.name}` : '';
        const invoiceNum = `INV-${Math.floor(100000 + Math.random() * 900000)} (Staff: ${cashierName}${customerText})`;

        const newOrder = await database.get('orders').create((ord: any) => {
          ord.business.set(dbBiz);
          ord.invoiceNumber = invoiceNum;
          ord.totalAmount = totalAmount;
          ord.status = 'paid';
          ord.paymentMethod = paymentMethod;
          ord.bankName = bankName;
          ord.cardLastFour = cardLastFour;
          ord.discountType = discountType;
          ord.discountValue = discountValue;
          ord.taxRate = taxRate;
          ord.taxValue = taxValue;
        });

        // Save order items & decrement products inventory stocks
        for (const item of cart) {
          await database.get('order_items').create((ordItem: any) => {
            ordItem.order.set(newOrder);
            ordItem.name = item.name;
            ordItem.quantity = item.quantity;
            ordItem.price = item.price;
          });

          // Decrement SQLite stock count
          const products = await database.get('products').query(Q.where('name', item.name)).fetch();
          if (products.length > 0) {
            const prod = products[0];
            await prod.update((p: any) => {
              p.stockCount = Math.max(0, p.stockCount - item.quantity);
            });

            // Log the stock outflow
            await database.get('inventory_logs').create((log: any) => {
              log.product.set(prod);
              log.type = 'out';
              log.quantity = item.quantity;
              log.reason = `Sale (${invoiceNum.split(' (')[0]})`;
            });
          }
        }
        return { orderId: newOrder.id, invoiceNumber: invoiceNum };
      });

      // Since database.write resolves to whatever the callback returns,
      // let's capture and return the written value.
      // Since database.write resolves to whatever the callback returns,
      // let's capture and return the written value.
      return result;
    },
    onSuccess: (data) => {
      // Invalidate products and orders query cache so changes are instantly visible!
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });

      // Trigger automatic background sync to Supabase without blocking the UX
      syncDatabase()
        .then((synced: boolean) => {
          if (synced) {
            console.log(
              'Background sync successfully pushed new order and stock changes to Supabase.'
            );
          }
        })
        .catch((err: any) => {
          console.error('Background auto-sync failed:', err);
        });
    },
  });
}

export function useGetPeriodOrders(
  period: 'daily' | 'monthly' | 'yearly' | 'custom',
  startDate: Date | null,
  endDate: Date | null
) {
  const activeBiz = useActiveBusiness();
  const PAGE_SIZE = 20;

  const result = useInfiniteQuery<DBOrder[]>({
    queryKey: ['period-orders', activeBiz.id, period, startDate, endDate],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = (pageParam as number) * PAGE_SIZE;
      let query = database
        .get('orders')
        .query(Q.where('business_id', activeBiz.id), Q.where('status', 'paid'));

      const today = new Date();
      let startTs = 0;
      let endTs = Date.now();

      if (period === 'daily') {
        startTs = new Date().setHours(0, 0, 0, 0);
        endTs = new Date().setHours(23, 59, 59, 999);
      } else if (period === 'monthly') {
        startTs = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
        endTs = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      } else if (period === 'yearly') {
        startTs = new Date(today.getFullYear(), 0, 1).getTime();
        endTs = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
      } else if (period === 'custom' && startDate && endDate) {
        startTs = new Date(startDate).getTime();
        endTs = new Date(endDate).getTime();
      }

      query = query.extend(
        Q.where('created_at', Q.between(startTs, endTs)),
        Q.sortBy('created_at', Q.desc),
        Q.skip(offset),
        Q.take(PAGE_SIZE)
      );

      const dbOrders = await query.fetch();
      return dbOrders.map((o: any) => ({
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        totalAmount: o.totalAmount,
        status: o.status,
        createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
        paymentMethod: o.paymentMethod,
        bankName: o.bankName,
        cardLastFour: o.cardLastFour,
        discountType: o.discountType,
        discountValue: o.discountValue,
        taxRate: o.taxRate,
        taxValue: o.taxValue,
      }));
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length < PAGE_SIZE ? undefined : allPages.length;
    },
  });

  const flattenedData = result.data ? result.data.pages.flat() : [];

  return {
    ...result,
    data: flattenedData,
  };
}
