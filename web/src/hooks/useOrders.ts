import { Q } from '@nozbe/watermelondb';
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import database from '../db/database';
import { useBusinessStore } from '../stores/businessStore';
import { useAuthStore } from '../stores/authStore';
import { syncDatabase } from '../services/sync';

export interface DBOrder {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string; // paid / voided
  createdAt: number;
  paymentMethod: string;
  bankName?: string;
  cardLastFour?: string;
  discountType?: string;
  discountValue?: number;
  taxRate?: number;
  taxValue?: number;
  cashierName?: string;
}

export interface DBOrderItem {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  price: number;
}

const mapDBOrder = (o: any): DBOrder => ({
  id: o.id,
  invoiceNumber: o.invoiceNumber,
  totalAmount: o.totalAmount,
  status: o.status,
  createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
  paymentMethod: o.paymentMethod || 'cash',
  bankName: o.bankName || '',
  cardLastFour: o.cardLastFour || '',
  discountType: o.discountType || 'none',
  discountValue: o.discountValue || 0,
  taxRate: o.taxRate || 0,
  taxValue: o.taxValue || 0,
  cashierName: o.invoiceNumber.includes('Staff:')
    ? o.invoiceNumber.split('Staff:')[1].split('|')[0].replace(')', '').trim()
    : 'Cashier',
});

export function useGetPaginatedOrders(page: number, pageSize: number, searchQuery?: string) {
  const activeBiz = useBusinessStore((s) => s.activeBusiness);

  return useQuery({
    queryKey: ['orders-paginated', activeBiz?.id, page, pageSize, searchQuery],
    queryFn: async () => {
      if (!activeBiz || activeBiz.id === '0') {
        return { orders: [], totalCount: 0, totalPages: 0 };
      }

      const clauses: any[] = [Q.where('business_id', activeBiz.id)];

      if (searchQuery && searchQuery.trim() !== '') {
        const sanitized = Q.sanitizeLikeString(searchQuery);
        clauses.push(
          Q.or(
            Q.where('invoice_number', Q.like(`%${sanitized}%`)),
            Q.where('payment_method', Q.like(`%${sanitized}%`)),
            Q.where('status', Q.like(`%${sanitized}%`))
          )
        );
      }

      // Total count query matching filters
      const countQuery = database.get('orders').query(...clauses);
      const totalCount = await countQuery.fetchCount();

      // Page data query
      const offset = (page - 1) * pageSize;
      const pageQuery = database
        .get('orders')
        .query(...clauses, Q.sortBy('created_at', Q.desc), Q.skip(offset), Q.take(pageSize));

      const dbOrders = await pageQuery.fetch();
      const orders = dbOrders.map(mapDBOrder);
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

      return {
        orders,
        totalCount,
        totalPages,
      };
    },
  });
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
  const employeeName = useAuthStore((s) => s.employeeName);

  return useMutation({
    mutationFn: async (params: {
      totalAmount: number;
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

      const cashierName = employeeName || 'Cashier';
      const invoiceNum = `INV-${Math.floor(100000 + Math.random() * 900000)} (Staff: ${cashierName})`;

      const result = await database.write(async () => {
        const bizs = await database.get('businesses').query(Q.where('id', businessId)).fetch();
        const dbBiz = bizs[0];
        if (!dbBiz) throw new Error('Business record not found');

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

        for (const item of cart) {
          const dbProducts = await database
            .get('products')
            .query(Q.where('name', item.name), Q.where('business_id', businessId))
            .fetch();
          let matchedProduct = null;

          if (dbProducts.length > 0) {
            matchedProduct = dbProducts[0];
          }

          const newOrderItem = await database.get('order_items').create((oi: any) => {
            oi.order.set(newOrder);
            if (matchedProduct) {
              oi.product.set(matchedProduct);
            }
            oi.name = item.name;
            oi.quantity = item.quantity;
            oi.price = item.price;
          });

          if (matchedProduct) {
            await database.get('inventory_logs').create((log: any) => {
              log.product.set(matchedProduct);
              log.type = 'out';
              log.quantity = item.quantity;
              log.reason = `Order Sale ${invoiceNum.split(' (')[0]}`;
            });
          }
        }

        return { orderId: newOrder.id, invoiceNumber: invoiceNum };
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      syncDatabase(); // Trigger real-time background replication
    },
  });
}

export function useVoidOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { orderId: string; invoiceNumber: string }) => {
      const { orderId, invoiceNumber } = params;
      const orderRecord = (await database.get('orders').find(orderId)) as any;
      const dbItems = await database.get('order_items').query(Q.where('order_id', orderId)).fetch();

      await database.write(async () => {
        const businessId = orderRecord.business.id;
        for (const item of dbItems as any[]) {
          const matchedProducts = await database
            .get('products')
            .query(Q.where('name', item.name), Q.where('business_id', businessId))
            .fetch();
          if (matchedProducts.length > 0) {
            const product: any = matchedProducts[0];
            const currentStock = product.stockCount;
            const updatedStock = currentStock + item.quantity;

            await product.update((p: any) => {
              p.stockCount = updatedStock;
            });

            await database.get('inventory_logs').create((log: any) => {
              log.product.set(product);
              log.type = 'in';
              log.quantity = item.quantity;
              log.reason = `Voided Invoice Sale ${invoiceNumber}`;
            });
          }
        }

        await orderRecord.update((ord: any) => {
          ord.status = 'voided';
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      syncDatabase(); // Trigger real-time background replication
    },
  });
}

export function useGetAllOrders() {
  const activeBiz = useBusinessStore((s) => s.activeBusiness);

  return {
    fetchAllOrders: async (searchQuery?: string) => {
      if (!activeBiz || activeBiz.id === '0') {
        return { orders: [], orderItems: [], products: [] };
      }

      // 1. Fetch matching orders directly from local database (no paging limit)
      let query = database
        .get('orders')
        .query(Q.where('business_id', activeBiz.id), Q.sortBy('created_at', Q.desc));

      const isSearchActive = searchQuery && searchQuery.trim() !== '';
      if (isSearchActive) {
        const sanitized = Q.sanitizeLikeString(searchQuery);
        query = query.extend(
          Q.or(
            Q.where('invoice_number', Q.like(`%${sanitized}%`)),
            Q.where('payment_method', Q.like(`%${sanitized}%`)),
            Q.where('status', Q.like(`%${sanitized}%`))
          )
        );
      }
      const dbOrders = await query.fetch();

      // Map DB orders to full records (matching hook structure + cashier extraction + date timestamp mapping)
      const mappedOrders = dbOrders.map((o: any) => ({
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod || 'cash',
        status: o.status || 'paid',
        discountType: o.discountType || 'none',
        discountValue: o.discountValue || 0,
        taxValue: o.taxValue || 0,
        taxRate: o.taxRate || 0,
        createdAt:
          o.createdAt instanceof Date
            ? o.createdAt.getTime()
            : typeof o.createdAt === 'number'
              ? o.createdAt
              : Date.now(),
        dateStr:
          o.createdAt instanceof Date
            ? o.createdAt.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
            : new Date(o.createdAt || Date.now()).toLocaleString([], {
                dateStyle: 'short',
                timeStyle: 'short',
              }),
        cashierName:
          o.invoiceNumber && o.invoiceNumber.includes('Staff:')
            ? o.invoiceNumber.split('Staff:')[1]?.split('|')[0]?.replace(')', '')?.trim() ||
              'Cashier'
            : 'Cashier',
        bankName: o.bankName || '',
        cardLastFour: o.cardLastFour || '',
      }));

      // 2. Fetch order items for these matched orders
      let orderItems: any[] = [];
      if (mappedOrders.length > 0) {
        const orderIds = mappedOrders.map((o) => o.id);
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

      // 3. Fetch products
      const products = await database
        .get('products')
        .query(Q.where('business_id', activeBiz.id))
        .fetch();

      return {
        orders: mappedOrders,
        orderItems,
        products,
      };
    },
  };
}
