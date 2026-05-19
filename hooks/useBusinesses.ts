import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/useAuthStore";
import { useBusinessStore, Business } from "../stores/useBusinessStore";

// Onboarding placeholder when no business is registered yet
const PLACEHOLDER_BUSINESS: Business = {
  id: "0",
  name: "Register Your Shop",
  category: "General Retail",
  address: "Complete onboarding setup",
  phone: "",
};

export function useBusinesses() {
  const loggedInPhone = useAuthStore((state) => state.userPhone);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return useQuery<Business[]>({
    queryKey: ["businesses", loggedInPhone, isLoggedIn],
    queryFn: async () => {
      if (!isLoggedIn || !loggedInPhone) {
        return [PLACEHOLDER_BUSINESS];
      }

      const db = require("../components/data/db").default;
      const { Q } = require("@nozbe/watermelondb");

      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, "");
        if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
        if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
        return cleaned;
      };

      const cleanLoggedInPhone = normalizePhone(loggedInPhone);
      const matchedBusinessesMap = new Map<string, any>();

      // 1. Fetch businesses where the logged-in user is a registered staff member (Employee)
      const allEmployees = await db.get("employees").query().fetch();
      const matchedEmployees = allEmployees.filter((emp: any) => {
        return normalizePhone(emp.phone || "") === cleanLoggedInPhone;
      });

      for (const emp of matchedEmployees) {
        const biz = await emp.business.fetch();
        if (biz) {
          matchedBusinessesMap.set(biz.id, biz);
        }
      }

      // 2. Fetch businesses owned directly by the logged-in user phone number
      const allBusinesses = await db.get("businesses").query().fetch();
      const matchedOwned = allBusinesses.filter((b: any) => {
        return normalizePhone(b.phoneNumber || "") === cleanLoggedInPhone;
      });

      for (const biz of matchedOwned) {
        matchedBusinessesMap.set(biz.id, biz);
      }

      const uniqueBusinesses = Array.from(matchedBusinessesMap.values());

      if (uniqueBusinesses.length === 0) {
        return [PLACEHOLDER_BUSINESS];
      }

      const list: Business[] = uniqueBusinesses.map((b: any) => ({
        id: b.id,
        name: b.name,
        category: b.businessType,
        address: b.address || "No Address Provided",
        phone: b.phoneNumber || "+94 ** *** ****",
      }));

      // Synchronize back to the business store list for backward compatibility
      useBusinessStore.setState({ businesses: list });
      
      // Keep the active business in sync if it's the placeholder or not in the list anymore
      const currentActive = useBusinessStore.getState().activeBusiness;
      const stillExists = list.find((b) => b.id === currentActive.id);
      if (!stillExists || currentActive.id === "0") {
        const targetBizId = useAuthStore.getState().activeBusinessId;
        const selectedBiz = list.find((b) => b.id === targetBizId) || list[0];
        useBusinessStore.setState({ activeBusiness: selectedBiz });
      }

      return list;
    },
  });
}

export function useRegisterBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      address: string;
      phone: string;
      category?: string;
    }) => {
      const { name, address, phone, category = "General Retail" } = params;
      const db = require("../components/data/db").default;
      
      let newBusinessRecord: any;
      await db.write(async () => {
        newBusinessRecord = await db.get("businesses").create((biz: any) => {
          biz.name = name;
          biz.businessType = category;
          biz.address = address;
          biz.phoneNumber = phone;
        });

        await db.get("employees").create((emp: any) => {
          emp.business.set(newBusinessRecord);
          emp.name = "Owner / Admin";
          emp.role = "admin";
          emp.phone = phone;
        });
      });

      // Seed products ONLY for the very first registered store in SQLite!
      const dbBizs = await db.get("businesses").query().fetch();
      if (dbBizs.length === 1) {
        const SEEDING_PRODUCTS = [
          { name: "Anchor Milk 1L", price: 680, category: "dairy", icon: "🥛", stockCount: 24, unitType: "Liters", costPrice: 580, quickCode: "1001" },
          { name: "Highland Yogurt", price: 95, category: "dairy", icon: "🥣", stockCount: 38, unitType: "Pieces", costPrice: 75, quickCode: "1008" },
          { name: "Marie Biscuits", price: 180, category: "snacks", icon: "🍪", stockCount: 4, unitType: "Packets", costPrice: 140, quickCode: "1002" },
          { name: "Lemon Puff 200g", price: 250, category: "snacks", icon: "🥮", stockCount: 16, unitType: "Packets", costPrice: 200, quickCode: "1004" },
          { name: "Cream Soda 1.5L", price: 320, category: "drinks", icon: "🥤", stockCount: 22, unitType: "Liters", costPrice: 260, quickCode: "1003" },
          { name: "Pepsi 1L", price: 280, category: "drinks", icon: "🥤", stockCount: 0, unitType: "Liters", costPrice: 220, quickCode: "1009" },
          { name: "Sunlight Soap", price: 130, category: "grocery", icon: "🧼", stockCount: 15, unitType: "Pieces", costPrice: 100, quickCode: "1005" },
          { name: "Red Rice 1kg", price: 280, category: "grocery", icon: "🌾", stockCount: 18, unitType: "kg", costPrice: 230, quickCode: "1006" },
          { name: "Ceylon Tea", price: 450, category: "drinks", icon: "☕", stockCount: 2, unitType: "Packets", costPrice: 380, quickCode: "1007" },
          { name: "Bread Loaf", price: 110, category: "grocery", icon: "🍞", stockCount: 12, unitType: "Pieces", costPrice: 85, quickCode: "1010" },
        ];
        
        await db.write(async () => {
          for (const item of SEEDING_PRODUCTS) {
            await db.get("products").create((p: any) => {
              p.business.set(newBusinessRecord);
              p.name = item.name;
              p.price = item.price;
              p.category = item.category;
              p.icon = item.icon;
              p.stockCount = item.stockCount;
              p.unitType = item.unitType;
              p.costPrice = item.costPrice;
              p.quickCode = item.quickCode;
            });
          }
        });
      }

      return { id: newBusinessRecord.id, name, category, address, phone };
    },
    onSuccess: (newBiz) => {
      // Invalidate businesses query cache so all components refetch instantly!
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      
      // Auto-activate the newly registered business
      const formattedBiz: Business = {
        id: newBiz.id,
        name: newBiz.name,
        category: newBiz.category,
        address: newBiz.address,
        phone: newBiz.phone,
      };
      
      useBusinessStore.getState().setActiveBusiness(newBiz.id);
      useAuthStore.getState().setActiveBusinessId(newBiz.id);
    },
  });
}

export function useUpdateActiveBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (details: { name: string; category: string; address: string; phone: string }) => {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      const db = require("../components/data/db").default;
      const { Q } = require("@nozbe/watermelondb");
      
      const businesses = await db.get("businesses").query(Q.where("id", activeBiz.id)).fetch();
      if (businesses.length > 0) {
        const targetBiz = businesses[0];
        await db.write(async () => {
          await targetBiz.update((b: any) => {
            b.name = details.name;
            b.businessType = details.category;
            b.address = details.address;
            b.phoneNumber = details.phone;
          });
        });
      } else {
        await db.write(async () => {
          await db.get("businesses").create((b: any) => {
            b.name = details.name;
            b.businessType = details.category;
            b.address = details.address;
            b.phoneNumber = details.phone;
          });
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}

export function useUpdateBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      details: { name: string; category: string; address: string; phone: string };
    }) => {
      const { id, details } = params;
      const db = require("../components/data/db").default;
      const { Q } = require("@nozbe/watermelondb");
      
      const businesses = await db.get("businesses").query(Q.where("id", id)).fetch();
      if (businesses.length > 0) {
        const targetBiz = businesses[0];
        await db.write(async () => {
          await targetBiz.update((b: any) => {
            b.name = details.name;
            b.businessType = details.category;
            b.address = details.address;
            b.phoneNumber = details.phone;
          });
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}

export function useDeleteBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const db = require("../components/data/db").default;
      const { Q } = require("@nozbe/watermelondb");
      
      const businesses = await db.get("businesses").query(Q.where("id", id)).fetch();
      if (businesses.length > 0) {
        const targetBiz = businesses[0];
        await db.write(async () => {
          await targetBiz.destroyPermanently();
        });
      }
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      
      // Fallback active business if deleted active one
      const currentActive = useBusinessStore.getState().activeBusiness;
      if (currentActive.id === deletedId) {
        const list = useBusinessStore.getState().businesses.filter((b) => b.id !== deletedId);
        if (list.length > 0) {
          useBusinessStore.getState().setActiveBusiness(list[0].id);
        } else {
          useBusinessStore.setState({ activeBusiness: PLACEHOLDER_BUSINESS });
        }
      }
    },
  });
}
