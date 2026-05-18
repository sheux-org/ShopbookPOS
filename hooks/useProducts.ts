import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cartState } from "../components/data/cartState";

export interface DBProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  stockCount: number;
  stockType: "normal" | "low" | "out";
  stockText: string;
  barcode?: string;
  quickCode?: string;
}

export function useProducts(category?: string, search?: string, activeChip?: string) {
  return useQuery<DBProduct[]>({
    queryKey: ["products", category, search, activeChip],
    queryFn: async () => {
      const db = require("../components/data/db").default;
      const { Q } = require("@nozbe/watermelondb");
      
      let query = db.get("products").query();

      if (category && category !== "all" && category !== "All") {
        query = query.extend(Q.where("category", category.toLowerCase()));
      }

      // Filter by active chip directly inside WatermelonDB
      if (activeChip) {
        if (activeChip === "In Stock") {
          query = query.extend(Q.where("stock_count", Q.gt(0)));
        } else if (activeChip === "Under Rs. 1000") {
          query = query.extend(Q.where("price", Q.lt(1000)));
        } else if (activeChip === "Low Stock") {
          query = query.extend(Q.where("stock_count", Q.between(1, 5)));
        } else if (activeChip === "Out of Stock") {
          query = query.extend(Q.where("stock_count", 0));
        }
      }

      if (search && search.trim() !== "") {
        const sanitized = Q.sanitizeLikeString(search);
        query = query.extend(
          Q.or(
            Q.where("name", Q.like(`%${sanitized}%`)),
            Q.where("category", Q.like(`%${sanitized}%`)),
            Q.where("barcode", Q.like(`%${sanitized}%`)),
            Q.where("quick_code", Q.like(`%${sanitized}%`))
          )
        );
      }

      const dbProducts = await query.fetch();
      
      return dbProducts.map((p: any) => {
        const stockCount = p.stockCount ?? 0;
        const stockType = stockCount === 0 ? "out" : stockCount <= 5 ? "low" : "normal";
        const stockText = stockType === "out" ? "Out of Stock" : stockType === "low" ? `Low · ${stockCount} remaining` : `${stockCount} in stock`;

        return {
          id: p.id,
          name: p.name,
          price: p.price,
          category: p.category ?? "grocery",
          icon: p.icon ?? "📦",
          stockCount,
          stockType,
          stockText,
          barcode: p.barcode,
          quickCode: p.quickCode,
        };
      });
    },
  });
}

export function useAddProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: {
      name: string;
      price: number;
      category: string;
      icon: string;
      stockCount: number;
      unitType?: string;
      costPrice?: number;
      quickCode?: string;
      barcode?: string;
    }) => {
      cartState.addNewCatalogProduct(product);
    },
    onSuccess: () => {
      // Invalidate the query key so all screens automatically refetch from WatermelonDB!
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
