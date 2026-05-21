import { Q } from "@nozbe/watermelondb";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cartState } from "../components/data/cartState";
import database from "../components/data/db";
import { syncDatabase } from "../services/sync";

export interface DBOrder {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  createdAt: number;
}

export interface DBOrderItem {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  price: number;
}

export function useGetOrders() {
  const activeBiz = cartState.getActiveBusiness();
  return useQuery<DBOrder[]>({
    queryKey: ["orders", activeBiz.id],
    queryFn: async () => {
      const query = database
        .get("orders")
        .query(
          Q.where("business_id", activeBiz.id),
          Q.sortBy("created_at", Q.desc),
        );

      const dbOrders = await query.fetch();
      return dbOrders.map((o: any) => ({
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        totalAmount: o.totalAmount,
        status: o.status,
        createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
      }));
    },
  });
}

export function useGetOrderItems(orderId?: string) {
  return useQuery<DBOrderItem[]>({
    queryKey: ["order_items", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return [];
      const query = database
        .get("order_items")
        .query(Q.where("order_id", orderId));

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
      cart: {
        name: string;
        price: number;
        quantity: number;
      }[];
    }) => {
      const { totalAmount, cashierName, businessId, cart } = params;
      let dbBiz: any;
      await database.write(async () => {
        // Find database business record
        const businesses = await database
          .get("businesses")
          .query(Q.where("id", businessId))
          .fetch();
        dbBiz = businesses[0];
        if (!dbBiz) {
          const allBizs = await database.get("businesses").query().fetch();
          dbBiz = allBizs[0];
        }

        if (!dbBiz) {
          throw new Error("No business record found in SQLite database!");
        }

        const customer = cartState.getCustomer();
        const customerText = customer ? ` | Cust: ${customer.name}` : "";
        const invoiceNum = `INV-${Math.floor(100000 + Math.random() * 900000)} (Staff: ${cashierName}${customerText})`;

        const newOrder = await database.get("orders").create((ord: any) => {
          ord.business.set(dbBiz);
          ord.invoiceNumber = invoiceNum;
          ord.totalAmount = totalAmount;
          ord.status = "paid";
        });

        // Save order items & decrement products inventory stocks
        for (const item of cart) {
          await database.get("order_items").create((ordItem: any) => {
            ordItem.order.set(newOrder);
            ordItem.name = item.name;
            ordItem.quantity = item.quantity;
            ordItem.price = item.price;
          });

          // Decrement SQLite stock count
          const products = await database
            .get("products")
            .query(Q.where("name", item.name))
            .fetch();
          if (products.length > 0) {
            const prod = products[0];
            await prod.update((p: any) => {
              p.stockCount = Math.max(0, p.stockCount - item.quantity);
            });
          }
        }
      });
    },
    onSuccess: () => {
      // Invalidate products and orders query cache so changes are instantly visible!
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });

      // Trigger automatic background sync to Supabase without blocking the UX
      syncDatabase()
        .then((synced: boolean) => {
          if (synced) {
            console.log(
              "Background sync successfully pushed new order and stock changes to Supabase.",
            );
          }
        })
        .catch((err: any) => {
          console.error("Background auto-sync failed:", err);
        });
    },
  });
}
