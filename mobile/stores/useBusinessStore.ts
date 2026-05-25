import { Q } from "@nozbe/watermelondb";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import database from "../components/data/db";
import { SEEDING_PRODUCTS } from "../utils/seedProducts";
import { useAuthStore } from "./useAuthStore";

export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  logoUri?: string;
}

interface BusinessState {
  businesses: Business[];
  activeBusiness: Business;
  setActiveBusiness: (id: string) => void;
  loadBusinessesFromDb: () => Promise<void>;
  registerBusiness: (
    name: string,
    address: string,
    phone: string,
    category?: string,
  ) => Promise<void>;
  updateActiveBusinessDetails: (details: {
    name: string;
    category: string;
    address: string;
    phone: string;
    logoUri?: string;
  }) => Promise<void>;
  updateBusinessDetails: (
    id: string,
    details: {
      name: string;
      category: string;
      address: string;
      phone: string;
      logoUri?: string;
    },
  ) => Promise<void>;
  deleteBusiness: (id: string) => Promise<void>;
}

// Clean onboarding placeholder when no business is registered yet
const PLACEHOLDER_BUSINESS: Business = {
  id: "0",
  name: "Register Your Shop",
  category: "General Retail",
  address: "Complete onboarding setup",
  phone: "",
  logoUri: "",
};

const DEFAULT_BUSINESSES: Business[] = [PLACEHOLDER_BUSINESS];

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set, get) => ({
      businesses: DEFAULT_BUSINESSES,
      activeBusiness: DEFAULT_BUSINESSES[0],
      setActiveBusiness: (id) => {
        const found = get().businesses.find((b) => b.id === id);
        if (found) {
          set({ activeBusiness: found });
        }
      },
      loadBusinessesFromDb: async () => {
        try {
          // 1. Wait for Auth hydration to finish from AsyncStorage
          if (!useAuthStore.persist.hasHydrated()) {
            console.log("Skipping business load: AuthStore not hydrated yet");
            return;
          }

          const loggedInPhone = useAuthStore.getState().userPhone;
          if (!loggedInPhone) {
            // Only reset to placeholder if the user is explicitly logged out
            if (!useAuthStore.getState().isLoggedIn) {
              set({
                businesses: DEFAULT_BUSINESSES,
                activeBusiness: DEFAULT_BUSINESSES[0],
              });
            }
            return;
          }

          const normalizePhone = (phoneStr: string): string => {
            let cleaned = phoneStr.replace(/\D/g, "");
            if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
            if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
            return cleaned;
          };

          const cleanLoggedInPhone = normalizePhone(loggedInPhone);
          const matchedBusinessesMap = new Map<string, any>();

          // 1. Fetch businesses where the logged-in user is a registered staff member (Employee)
          const allEmployees = await database.get("employees").query().fetch();
          const matchedEmployees = allEmployees.filter((emp: any) => {
            return normalizePhone(emp.phone || "") === cleanLoggedInPhone;
          });

          for (const emp of matchedEmployees) {
            const biz = await (emp as any).business.fetch();
            if (biz) {
              matchedBusinessesMap.set(biz.id, biz);
            }
          }

          // 2. Fetch businesses owned directly by the logged-in user phone number
          const allBusinesses = await database
            .get("businesses")
            .query()
            .fetch();
          const matchedOwned = allBusinesses.filter((b: any) => {
            return normalizePhone(b.phoneNumber || "") === cleanLoggedInPhone;
          });

          for (const biz of matchedOwned) {
            matchedBusinessesMap.set(biz.id, biz);
          }

          const uniqueBusinesses = Array.from(matchedBusinessesMap.values());

          const list: Business[] = uniqueBusinesses.map((b: any) => ({
            id: b.id,
            name: b.name,
            category: b.businessType,
            address: b.address || "No Address Provided",
            phone: b.phoneNumber || "+94 ** *** ****",
            logoUri: b.logoUri || "",
          }));

          // Determine target business to activate
          const targetBizId =
            useAuthStore.getState().activeBusinessId || get().activeBusiness.id;

          if (list.length > 0) {
            const selectedBiz =
              list.find((b) => b.id === targetBizId) || list[0];
            set({
              businesses: list,
              activeBusiness: selectedBiz,
            });
          } else {
            set({
              businesses: [PLACEHOLDER_BUSINESS],
              activeBusiness: PLACEHOLDER_BUSINESS,
            });
          }
        } catch (err) {
          console.error("Failed to load businesses from SQLite:", err);
        }
      },
      registerBusiness: async (
        name,
        address,
        phone,
        category = "General Retail",
      ) => {
        try {
          let newBusinessRecord: any;
          await database.write(async () => {
            newBusinessRecord = await database
              .get("businesses")
              .create((biz: any) => {
                biz.name = name;
                biz.businessType = category;
                biz.address = address;
                biz.phoneNumber = phone;
              });

            await database.get("employees").create((emp: any) => {
              emp.business.set(newBusinessRecord);
              emp.name = "Owner / Admin";
              emp.role = "admin";
              emp.phone = phone;
            });
          });
          console.log(
            "Successfully saved business and admin employee to local database",
          );

          // Seed products ONLY for the very first registered store in SQLite!
          const dbBizs = await database.get("businesses").query().fetch();
          if (dbBizs.length === 1) {
            console.log(
              "First brand business registered. Seeding dynamic inventory catalog in SQLite...",
            );
            const existingProducts = await database
              .get("products")
              .query()
              .fetch();
            if (existingProducts.length === 0) {
              // Use centralized seed data to avoid duplication and 404-prone image links
              await database.write(async () => {
                for (const item of SEEDING_PRODUCTS) {
                  await database.get("products").create((p: any) => {
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
              console.log(
                "Successfully seeded catalog products for the first registered business!",
              );
            }
          }

          await get().loadBusinessesFromDb();

          if (newBusinessRecord) {
            const found = get().businesses.find((b) => b.name === name);
            if (found) {
              set({ activeBusiness: found });
            }
          }
        } catch (err) {
          console.error(
            "Failed to write business/employee to local database:",
            err,
          );
        }
      },
      updateActiveBusinessDetails: async (details) => {
        const activeBiz = get().activeBusiness;

        try {
          const businesses = await database
            .get("businesses")
            .query(Q.where("id", activeBiz.id))
            .fetch();
          if (businesses.length > 0) {
            const targetBiz = businesses[0];
            await database.write(async () => {
              await targetBiz.update((b: any) => {
                b.name = details.name;
                b.businessType = details.category;
                b.address = details.address;
                b.phoneNumber = details.phone;
                if (details.logoUri !== undefined) {
                  b.logoUri = details.logoUri;
                }
              });
            });
            console.log(
              "Successfully updated business details in local WatermelonDB database",
            );
          } else {
            await database.write(async () => {
              await database.get("businesses").create((b: any) => {
                b.name = details.name;
                b.businessType = details.category;
                b.address = details.address;
                b.phoneNumber = details.phone;
                b.logoUri = details.logoUri || "";
              });
            });
            console.log(
              "Successfully created business details in local WatermelonDB database",
            );
          }

          await get().loadBusinessesFromDb();
        } catch (err) {
          console.error(
            "Failed to update business details in WatermelonDB:",
            err,
          );
        }
      },
      updateBusinessDetails: async (id, details) => {
        try {
          const businesses = await database
            .get("businesses")
            .query(Q.where("id", id))
            .fetch();
          if (businesses.length > 0) {
            const targetBiz = businesses[0];
            await database.write(async () => {
              await targetBiz.update((b: any) => {
                b.name = details.name;
                b.businessType = details.category;
                b.address = details.address;
                b.phoneNumber = details.phone;
                if (details.logoUri !== undefined) {
                  b.logoUri = details.logoUri;
                }
              });
            });
            console.log(
              "Successfully updated business details in local WatermelonDB database",
            );
          }
          await get().loadBusinessesFromDb();
        } catch (err) {
          console.error(
            "Failed to update business details in WatermelonDB:",
            err,
          );
        }
      },
      deleteBusiness: async (id) => {
        try {
          const businesses = await database
            .get("businesses")
            .query(Q.where("id", id))
            .fetch();
          if (businesses.length > 0) {
            const targetBiz = businesses[0];
            await database.write(async () => {
              await targetBiz.destroyPermanently();
            });
            console.log("Successfully deleted business record");
          }
          await get().loadBusinessesFromDb();

          if (get().activeBusiness.id === id) {
            const remaining = get().businesses;
            if (remaining.length > 0) {
              set({ activeBusiness: remaining[0] });
            }
          }
        } catch (err) {
          console.error("Failed to delete business from WatermelonDB:", err);
        }
      },
    }),
    {
      name: "business-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
