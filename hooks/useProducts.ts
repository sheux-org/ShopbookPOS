import { Q } from "@nozbe/watermelondb";
import * as NetInfo from "@react-native-community/netinfo";
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { cartState } from "../components/data/cartState";
import database from "../components/data/db";
import {
  deleteUploadThingFile,
  processUploadQueue,
  queueImageUpload,
  removeProductImage,
} from "../services/uploadQueue";

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
  isFavorite?: boolean;
  unitType?: string;
  costPrice?: number;
  lowStockAlert?: number;
  createdAt?: number;
}

export function useProducts(
  category?: string,
  search?: string,
  activeChip?: string,
) {
  const activeBiz = cartState.getActiveBusiness();
  const PAGE_SIZE = 30;

  const result = useInfiniteQuery<DBProduct[]>({
    queryKey: ["products", activeBiz.id, category, search, activeChip],
    queryFn: async ({ pageParam = 0 }) => {
      let query = database.get("products").query();

      // Isolate products strictly by active business ID
      query = query.extend(Q.where("business_id", activeBiz.id));

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
        } else if (activeChip === "Favorites" || activeChip === "favorites") {
          query = query.extend(Q.where("is_favorite", true));
        } else if (activeChip === "Recents" || activeChip === "recents") {
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

      // If activeChip is NOT "Recents", we paginate using limit and offset
      if (activeChip !== "Recents" && activeChip !== "recents") {
        const offset = (pageParam as number) * PAGE_SIZE;
        query = query.extend(Q.skip(offset), Q.take(PAGE_SIZE));
      }

      const dbProducts = await query.fetch();

      return dbProducts.map((p: any) => {
        const stockCount = p.stockCount ?? 0;
        const stockType =
          stockCount === 0 ? "out" : stockCount <= 5 ? "low" : "normal";
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
          // Only return a real photo URL — ProductImage renders placeholder for non-URLs
          icon: p.icon ?? "",
          stockCount,
          stockType,
          stockText,
          barcode: p.barcode,
          quickCode: p.quickCode,
          sku: p.sku,
          isFavorite: p.isFavorite ?? false,
          unitType: p.unitType ?? "Pieces",
          costPrice: p.costPrice,
          lowStockAlert: p.lowStockAlert ?? 5,
          createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
        };
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (activeChip === "Recents" || activeChip === "recents") {
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

/**
 * Returns all products in the current business that have a real photo
 * (icon starts with http:// or file://) — used in the image reuse gallery.
 */
export function useUploadedProductImages() {
  const activeBiz = cartState.getActiveBusiness();
  return useQuery<{ id: string; name: string; icon: string }[]>({
    queryKey: ["uploaded-images", activeBiz.id],
    queryFn: async () => {
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
      await cartState.addNewCatalogProduct(product);
    },
    onSuccess: () => {
      // Invalidate the query key so all screens automatically refetch from WatermelonDB!
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // Trigger background upload queue check immediately as fallback
      try {
        processUploadQueue();
      } catch (err) {
        console.error("Failed to run upload queue from hook:", err);
      }
    },
  });
}

export function useToggleFavoriteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const product = await database.get("products").find(id);
      await database.write(async () => {
        await product.update((p: any) => {
          p.isFavorite = !p.isFavorite;
        });
      });
    },
    onSuccess: () => {
      // Invalidate products query cache so all components refetch instantly!
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/**
 * useUpdateProductImage
 *
 * Offline-first product image picker + upload hook.
 * 1. Shows camera / gallery picker alert
 * 2. Saves local URI to WatermelonDB instantly → UI updates immediately
 * 3. If online: uploads to UploadThing right away and saves https:// URL
 * 4. If offline: image queued — auto-uploads when connectivity returns
 */
export function useUpdateProductImage() {
  const queryClient = useQueryClient();

  const pickAndUpload = async (productId: string) => {
    Alert.alert("Product Image", "Choose how to add a product image", [
      {
        text: "📷 Camera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission needed", "Camera permission is required.");
            return;
          }
          try {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1] as [number, number],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]?.uri) {
              const state = await NetInfo.fetch();
              const isOnline =
                (state.isConnected ?? false) &&
                state.isInternetReachable !== false;
              await queueImageUpload(productId, result.assets[0].uri, isOnline);
              queryClient.invalidateQueries({ queryKey: ["products"] });
            }
          } catch {
            // Camera not available (e.g. simulator) — fall back to gallery
            Alert.alert(
              "Camera Unavailable",
              "Camera is not available on this device. Please use the Gallery option.",
            );
          }
        },
      },
      {
        text: "🖼️ Gallery",
        onPress: async () => {
          const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              "Permission needed",
              "Photo library permission is required.",
            );
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1] as [number, number],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]?.uri) {
            const state = await NetInfo.fetch();
            const isOnline =
              (state.isConnected ?? false) &&
              state.isInternetReachable !== false;
            await queueImageUpload(productId, result.assets[0].uri, isOnline);
            queryClient.invalidateQueries({ queryKey: ["products"] });
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return { pickAndUpload };
}

/**
 * useRemoveProductImage
 *
 * Removes a product's image:
 * 1. Shows a confirmation alert ("Remove Image?")
 * 2. If confirmed: deletes from UploadThing (if it was a remote URL)
 * 3. Resets WatermelonDB `icon` back to the category emoji
 * 4. Invalidates query cache so HomeScreen + StocksScreen refresh instantly
 */
export function useRemoveProductImage() {
  const queryClient = useQueryClient();

  const confirmAndRemove = (
    productId: string,
    currentIcon: string,
    productName: string,
  ) => {
    // Only show if there's actually a custom image (not just an emoji)
    const hasCustomImage =
      currentIcon.startsWith("http") ||
      currentIcon.startsWith("file://") ||
      currentIcon.startsWith("/");

    if (!hasCustomImage) {
      Alert.alert(
        "No Custom Image",
        `"${productName}" is using the default emoji icon.`,
      );
      return;
    }

    Alert.alert(
      "Remove Image?",
      `This will delete the photo for "${productName}" and reset it to the default icon.`,
      [
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeProductImage(productId);
            queryClient.invalidateQueries({ queryKey: ["products"] });
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  return { confirmAndRemove };
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
    }) => {
      const {
        id,
        name,
        price,
        category,
        icon,
        stockCount,
        unitType,
        costPrice,
        quickCode,
        barcode,
      } = params;
      const product = await database.get("products").find(id);

      await database.write(async () => {
        await product.update((p: any) => {
          p.name = name;
          p.price = price;
          p.category = category;
          p.icon = icon;
          p.stockCount = stockCount;
          p.unitType = unitType;
          p.costPrice = costPrice;
          p.quickCode = quickCode;
          p.barcode = barcode;

          // Set pending upload flag if it's a local uri
          const iconUri = icon ?? "";
          const isLocal =
            iconUri.startsWith("file://") || iconUri.startsWith("/");
          p.iconPendingUpload = isLocal;
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["uploaded-images"] });
      // Trigger background upload queue check immediately
      try {
        processUploadQueue();
      } catch (err) {
        console.error("Failed to run upload queue from hook:", err);
      }
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const product = await database.get("products").find(id);

      // Clean up uploaded image if it was a remote URL
      const currentIcon: string = (product as any).icon ?? "";
      const isRemoteUrl = currentIcon.startsWith("http");
      if (isRemoteUrl) {
        try {
          await deleteUploadThingFile(currentIcon);
        } catch (e) {
          console.error("Failed to delete product file from UploadThing:", e);
        }
      }

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

export function useStockInProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      productId: string;
      quantity: number;
      reason?: string;
    }) => {
      const { productId, quantity, reason } = params;
      const product = await database.get("products").find(productId);

      await database.write(async () => {
        // Create inventory log
        await database.get("inventory_logs").create((log: any) => {
          log.product.set(product);
          log.type = "in";
          log.quantity = quantity;
          log.reason = reason || "Restock";
        });

        // Update product stock count
        await product.update((p: any) => {
          p.stockCount = (p.stockCount ?? 0) + quantity;
        });
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({
        queryKey: ["stock-history", variables.productId],
      });
    },
  });
}

export function useProduct(id?: string) {
  return useQuery<DBProduct>({
    queryKey: ["product", id],
    queryFn: async () => {
      if (!id) throw new Error("Product ID is required");
      const p = await database.get("products").find(id);
      const stockCount = (p as any).stockCount ?? 0;
      const stockType =
        stockCount === 0 ? "out" : stockCount <= 5 ? "low" : "normal";
      const stockText =
        stockType === "out"
          ? "Out of Stock"
          : stockType === "low"
            ? `Low · ${stockCount} remaining`
            : `${stockCount} in stock`;

      return {
        id: p.id,
        name: (p as any).name,
        price: (p as any).price,
        category: (p as any).category ?? "grocery",
        icon: (p as any).icon ?? "",
        stockCount,
        stockType,
        stockText,
        barcode: (p as any).barcode,
        quickCode: (p as any).quickCode,
        sku: (p as any).sku,
        isFavorite: (p as any).isFavorite ?? false,
        unitType: (p as any).unitType ?? "Pieces",
        costPrice: (p as any).costPrice,
        lowStockAlert: (p as any).lowStockAlert ?? 5,
        createdAt: (p as any).createdAt ? new Date((p as any).createdAt).getTime() : Date.now(),
      };
    },
    enabled: !!id,
  });
}

export function useFindProductByBarcode() {
  const activeBiz = cartState.getActiveBusiness();
  return async (barcode: string): Promise<DBProduct | null> => {
    const dbProducts = await database
      .get("products")
      .query(
        Q.where("business_id", activeBiz.id),
        Q.where("barcode", barcode),
      )
      .fetch();

    if (dbProducts && dbProducts.length > 0) {
      const p: any = dbProducts[0];
      const stockCount = p.stockCount ?? 0;
      const stockType =
        stockCount === 0 ? "out" : stockCount <= 5 ? "low" : "normal";
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
        icon: p.icon ?? "",
        stockCount,
        stockType,
        stockText,
        barcode: p.barcode,
        quickCode: p.quickCode,
        sku: p.sku,
        isFavorite: p.isFavorite ?? false,
        unitType: p.unitType ?? "Pieces",
        costPrice: p.costPrice,
        lowStockAlert: p.lowStockAlert ?? 5,
        createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
      };
    }
    return null;
  };
}

export function useFindProductByCode() {
  const activeBiz = cartState.getActiveBusiness();
  return async (code: string): Promise<DBProduct | null> => {
    const dbProducts = await database
      .get("products")
      .query(
        Q.where("business_id", activeBiz.id),
        Q.or(
          Q.where("barcode", code),
          Q.where("quick_code", code)
        )
      )
      .fetch();

    if (dbProducts && dbProducts.length > 0) {
      const p: any = dbProducts[0];
      const stockCount = p.stockCount ?? 0;
      const stockType =
        stockCount === 0 ? "out" : stockCount <= 5 ? "low" : "normal";
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
        icon: p.icon ?? "",
        stockCount,
        stockType,
        stockText,
        barcode: p.barcode,
        quickCode: p.quickCode,
        sku: p.sku,
        isFavorite: p.isFavorite ?? false,
        unitType: p.unitType ?? "Pieces",
        costPrice: p.costPrice,
        lowStockAlert: p.lowStockAlert ?? 5,
        createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
      };
    }
    return null;
  };
}

