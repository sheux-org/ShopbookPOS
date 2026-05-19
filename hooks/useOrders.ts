import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cartState } from "../components/data/cartState";

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      totalAmount: number;
      cashierName: string;
      businessId: string;
      cart: Array<{
        name: string;
        price: number;
        quantity: number;
      }>;
    }) => {
      const { totalAmount, cashierName, businessId, cart } = params;
      const db = require("../components/data/db").default;
      const { Q } = require("@nozbe/watermelondb");

      let dbBiz: any;
      await db.write(async () => {
        // Find database business record
        const businesses = await db.get("businesses").query(Q.where("id", businessId)).fetch();
        dbBiz = businesses[0];
        if (!dbBiz) {
          const allBizs = await db.get("businesses").query().fetch();
          dbBiz = allBizs[0];
        }

        if (!dbBiz) {
          throw new Error("No business record found in SQLite database!");
        }

        const invoiceNum = `INV-${Math.floor(100000 + Math.random() * 900000)} (Staff: ${cashierName})`;

        const newOrder = await db.get("orders").create((ord: any) => {
          ord.business.set(dbBiz);
          ord.invoiceNumber = invoiceNum;
          ord.totalAmount = totalAmount;
          ord.status = "paid";
        });

        // Save order items & decrement products inventory stocks
        for (const item of cart) {
          await db.get("order_items").create((ordItem: any) => {
            ordItem.order.set(newOrder);
            ordItem.name = item.name;
            ordItem.quantity = item.quantity;
            ordItem.price = item.price;
          });

          // Decrement SQLite stock count
          const products = await db.get("products").query(Q.where("name", item.name)).fetch();
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
      // Invalidate products query cache so inventory stock changes are instantly visible!
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
