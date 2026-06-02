import { Q } from "@nozbe/watermelondb";
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import database from "../db/database";
import { useBusinessStore } from "../stores/businessStore";

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
  sku?: string;
  isFavorite: boolean;
  unitType?: string;
  costPrice?: number;
  lowStockAlert?: number;
  createdAt?: number;
}

export const mapDBProduct = (p: any): DBProduct => {
  const stockCount = p.stockCount ?? 0;
  const stockType =
    stockCount === 0 ? "out" : stockCount <= (p.lowStockAlert ?? 5) ? "low" : "normal";
  const stockText =
    stockType === "out"
      ? "Out of Stock"
      : stockType === "low"
        ? `Low · ${stockCount} remaining`
        : `${stockCount} in stock`;

  return {
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category ?? "grocery",
    icon: p.icon ?? "📦",
    stockCount,
    stockType,
    stockText,
    barcode: p.barcode || "",
    quickCode: p.quickCode || "",
    sku: p.sku || "",
    isFavorite: p.isFavorite ?? false,
    unitType: p.unitType ?? "Pieces",
    costPrice: p.costPrice ?? 0,
    lowStockAlert: p.lowStockAlert ?? 5,
    createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
  };
};

export function useProducts(
  category?: string,
  search?: string,
  activeChip?: string,
) {
  const activeBiz = useBusinessStore((s) => s.activeBusiness);
  const PAGE_SIZE = 30;

  const result = useInfiniteQuery<DBProduct[]>({
    queryKey: ["products", activeBiz?.id, category, search, activeChip],
    queryFn: async ({ pageParam = 0 }) => {
      if (!activeBiz || activeBiz.id === "0") return [];

      let query = database.get("products").query();

      // Isolate products strictly by active business ID
      query = query.extend(Q.where("business_id", activeBiz.id));

      if (category && category !== "all" && category !== "All") {
        query = query.extend(Q.where("category", category.toLowerCase()));
      }

      // Filter by active chip directly inside WatermelonDB
      if (activeChip) {
        const chipLower = activeChip.toLowerCase();
        if (activeChip === "In Stock") {
          query = query.extend(Q.where("stock_count", Q.gt(0)));
        } else if (activeChip === "Under Rs. 1000") {
          query = query.extend(Q.where("price", Q.lt(1000)));
        } else if (activeChip === "Low Stock") {
          // Filtered in memory to support custom thresholds
          query = query.extend(Q.where("stock_count", Q.gt(0)));
        } else if (activeChip === "Out of Stock") {
          query = query.extend(Q.where("stock_count", 0));
        } else if (chipLower === "favorites") {
          query = query.extend(Q.where("is_favorite", true));
        } else if (chipLower === "recents") {
          query = query.extend(Q.sortBy("created_at", Q.desc), Q.take(4));
        }
      }

      if (search && search.trim() !== "") {
        const sanitized = Q.sanitizeLikeString(search);
        query = query.extend(
          Q.or(
            Q.where("name", Q.like(`%${sanitized}%`)),
            Q.where("category", Q.like(`%${sanitized}%`)),
            Q.where("barcode", Q.like(`%${sanitized}%`)),
            Q.where("quick_code", Q.like(`%${sanitized}%`)),
          ),
        );
      }

      // Apply Search pagination rule:
      // "For search, first fetch all data from database, then paginate the returning data."
      const isSearchActive = search && search.trim() !== "";
      const isLowStockChip = activeChip === "Low Stock";
      const isRecentsChip = activeChip?.toLowerCase() === "recents";

      if (isSearchActive) {
        // Fetch all matching data without limit/offset at database level
        let dbProducts = await query.fetch();

        if (isLowStockChip) {
          dbProducts = dbProducts.filter((p: any) => {
            const stockCount = p.stockCount ?? 0;
            const threshold = p.lowStockAlert ?? 5;
            return stockCount > 0 && stockCount <= threshold;
          });
        }

        // Paginate manually on the returned array
        const offset = (pageParam as number) * PAGE_SIZE;
        const sliced = dbProducts.slice(offset, offset + PAGE_SIZE);
        return sliced.map(mapDBProduct);
      } else {
        // Standard list: paginate at database level if not recents/low stock
        if (!isRecentsChip && !isLowStockChip) {
          const offset = (pageParam as number) * PAGE_SIZE;
          query = query.extend(Q.skip(offset), Q.take(PAGE_SIZE));
        }

        let dbProducts = await query.fetch();

        if (isLowStockChip) {
          dbProducts = dbProducts.filter((p: any) => {
            const stockCount = p.stockCount ?? 0;
            const threshold = p.lowStockAlert ?? 5;
            return stockCount > 0 && stockCount <= threshold;
          });
        }

        return dbProducts.map(mapDBProduct);
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (activeChip?.toLowerCase() === "recents") {
        return undefined;
      }
      return lastPage.length < PAGE_SIZE ? undefined : allPages.length;
    },
  });

  const flattenedData = result.data ? result.data.pages.flat() : [];

  return {
    ...result,
    data: flattenedData,
  };
}

export function useProduct(id?: string) {
  return useQuery<DBProduct>({
    queryKey: ["product", id],
    queryFn: async () => {
      if (!id) throw new Error("Product ID is required");
      const p = await database.get("products").find(id);
      return mapDBProduct(p);
    },
    enabled: !!id,
  });
}

export function useUploadedProductImages() {
  const activeBiz = useBusinessStore((s) => s.activeBusiness);
  return useQuery<{ id: string; name: string; icon: string }[]>({
    queryKey: ["uploaded-images", activeBiz?.id],
    queryFn: async () => {
      if (!activeBiz || activeBiz.id === "0") return [];
      const products = await database
        .get("products")
        .query(Q.where("business_id", activeBiz.id))
        .fetch();

      return products
        .filter((p: any) => {
          const icon: string = p.icon ?? "";
          return (
            icon.startsWith("http") ||
            icon.startsWith("file://") ||
            icon.startsWith("/")
          );
        })
        .map((p: any) => ({ id: p.id, name: p.name, icon: p.icon ?? "" }));
    },
  });
}

export function useAddProduct() {
  const queryClient = useQueryClient();
  const activeBiz = useBusinessStore((s) => s.activeBusiness);

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
      lowStockAlert?: number;
    }) => {
      if (!activeBiz || activeBiz.id === "0") {
        throw new Error("No active business selected!");
      }

      await database.write(async () => {
        const bizs = await database.get("businesses").query(Q.where("id", activeBiz.id)).fetch();
        const dbBiz = bizs[0];
        if (!dbBiz) throw new Error("Business database record not found");

        const newProd = await database.get("products").create((p: any) => {
          p.business.set(dbBiz);
          p.name = product.name;
          p.price = product.price;
          p.category = product.category.toLowerCase();
          p.icon = product.icon;
          p.stockCount = product.stockCount;
          p.unitType = product.unitType || "Pieces";
          p.costPrice = product.costPrice || 0;
          p.quickCode = product.quickCode || "";
          p.barcode = product.barcode || "";
          p.lowStockAlert = product.lowStockAlert ?? 5;
          p.isFavorite = false;
        });

        if (product.stockCount > 0) {
          await database.get("inventory_logs").create((log: any) => {
            log.product.set(newProd);
            log.type = "in";
            log.quantity = product.stockCount;
            log.reason = "Initial Seed";
          });
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name: string;
      price: number;
      category: string;
      icon: string;
      stockCount: number;
      unitType?: string;
      costPrice?: number;
      quickCode?: string;
      barcode?: string;
      lowStockAlert?: number;
    }) => {
      const product = await database.get("products").find(params.id);

      await database.write(async () => {
        const oldStock = (product as any).stockCount ?? 0;
        const newStock = params.stockCount;

        await product.update((p: any) => {
          p.name = params.name;
          p.price = params.price;
          p.category = params.category.toLowerCase();
          p.icon = params.icon;
          p.stockCount = newStock;
          p.unitType = params.unitType || "Pieces";
          p.costPrice = params.costPrice || 0;
          p.quickCode = params.quickCode || "";
          p.barcode = params.barcode || "";
          p.lowStockAlert = params.lowStockAlert ?? 5;
        });

        if (newStock !== oldStock) {
          await database.get("inventory_logs").create((log: any) => {
            log.product.set(product);
            log.type = newStock > oldStock ? "in" : "out";
            log.quantity = Math.abs(newStock - oldStock);
            log.reason = "Manual Adjustment";
          });
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["uploaded-images"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const product = await database.get("products").find(id);
      await database.write(async () => {
        await product.destroyPermanently();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["uploaded-images"] });
    },
  });
}

export function useToggleFavoriteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; isFavorite: boolean }) => {
      const product = await database.get("products").find(params.id);
      await database.write(async () => {
        await product.update((p: any) => {
          p.isFavorite = !params.isFavorite;
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export interface DBInventoryLog {
  id: string;
  productId: string;
  type: "in" | "out";
  quantity: number;
  reason?: string;
  createdAt: number;
}

export function useGetStockHistory(productId: string) {
  const PAGE_SIZE = 20;
  const result = useInfiniteQuery<DBInventoryLog[]>({
    queryKey: ["stock-history", productId],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = (pageParam as number) * PAGE_SIZE;
      const logs = await database
        .get("inventory_logs")
        .query(
          Q.where("product_id", productId),
          Q.sortBy("created_at", Q.desc),
          Q.skip(offset),
          Q.take(PAGE_SIZE),
        )
        .fetch();

      return logs.map((l: any) => ({
        id: l.id,
        productId: l.product.id,
        type: l.type,
        quantity: l.quantity,
        reason: l.reason,
        createdAt: l.createdAt ? new Date(l.createdAt).getTime() : Date.now(),
      }));
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length < PAGE_SIZE ? undefined : allPages.length;
    },
    enabled: !!productId,
  });

  const flattenedData = result.data ? result.data.pages.flat() : [];

  return {
    ...result,
    data: flattenedData,
  };
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      productId: string;
      quantity: number;
      type: "in" | "out";
      reason?: string;
    }) => {
      const { productId, quantity, type, reason } = params;
      const product = await database.get("products").find(productId);

      await database.write(async () => {
        await database.get("inventory_logs").create((log: any) => {
          log.product.set(product);
          log.type = type;
          log.quantity = quantity;
          log.reason = reason || (type === "in" ? "Restock" : "Deduction");
        });

        await product.update((p: any) => {
          const current = p.stockCount ?? 0;
          p.stockCount = type === "in" ? current + quantity : Math.max(0, current - quantity);
        });
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({
        queryKey: ["stock-history", variables.productId],
      });
      queryClient.invalidateQueries({ queryKey: ["global-stock-history"] });
    },
  });
}

export interface DBGlobalInventoryLog {
  id: string;
  productName: string;
  productIcon: string;
  type: "in" | "out";
  quantity: number;
  reason?: string;
  date: string;
}

export function useGetGlobalStockHistory(businessId: string) {
  return useQuery<DBGlobalInventoryLog[]>({
    queryKey: ["global-stock-history", businessId],
    queryFn: async () => {
      if (!businessId || businessId === "0") return [];

      const allLogs = await database.get("inventory_logs").query().fetch();
      const mappedLogs: DBGlobalInventoryLog[] = [];
      for (const logItem of allLogs) {
        const log = logItem as any;
        const prod = await log.product.fetch();
        if (prod && prod.business.id === businessId) {
          mappedLogs.push({
            id: log.id,
            productName: prod.name,
            productIcon: prod.icon || "📦",
            type: log.type,
            quantity: log.quantity,
            reason: log.reason,
            date: new Date(log.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }),
          });
        }
      }

      // Sort logs newest first
      return mappedLogs.sort((a, b) => b.id.localeCompare(a.id));
    },
    enabled: !!businessId && businessId !== "0",
  });
}
