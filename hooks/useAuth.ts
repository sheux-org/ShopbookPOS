import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/useAuthStore";
import { useBusinessStore } from "../stores/useBusinessStore";

export function useVerifyOtp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { phone: string; otp: string }) => {
      const { phone, otp } = params;

      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, "");
        if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
        if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
        return cleaned;
      };

      const cleanPhone = normalizePhone(phone);

      if (otp !== "1111") {
        throw new Error("Invalid OTP. Hint: Use 1111");
      }

      const db = require("../components/data/db").default;
      const allEmployees = await db.get("employees").query().fetch();

      const matchedEmployee = allEmployees.find((emp: any) => {
        return normalizePhone(emp.phone || "") === cleanPhone;
      });

      if (matchedEmployee) {
        const bizRelation = matchedEmployee.business;
        const activeBiz = await bizRelation.fetch();
        if (activeBiz) {
          return {
            status: "success" as const,
            type: "employee" as const,
            phone: cleanPhone,
            role: matchedEmployee.role || "cashier",
            name: matchedEmployee.name || "Staff Member",
            businessId: activeBiz.id,
            employeeId: matchedEmployee.id,
          };
        }
      }

      const allBusinesses = await db.get("businesses").query().fetch();
      const matchedBiz = allBusinesses.find((biz: any) => {
        return normalizePhone(biz.phoneNumber || "") === cleanPhone;
      });

      if (matchedBiz) {
        return {
          status: "success" as const,
          type: "owner" as const,
          phone: cleanPhone,
          role: "admin",
          name: "Owner / Admin",
          businessId: matchedBiz.id,
          employeeId: "owner",
        };
      }

      // If not found locally, check if there is a synced account in the Supabase database
      try {
        const { supabase } = require("../services/sync");
        const { data: remoteData, error: remoteError } = await supabase.rpc("check_synced_account", {
          input_phone: cleanPhone,
        });

        if (remoteError) {
          console.error("Failed to query remote synced account from Supabase:", remoteError);
        } else if (remoteData && remoteData.exists) {
          // Set backup/sync as enabled in settings store
          const { useSettingsStore } = require("../stores/useSettingsStore");
          useSettingsStore.getState().setBackupEnabled(true);

          // Force sync to pull all tables (businesses, employees, products, orders, etc.) from Supabase
          const { syncDatabase } = require("../services/sync");
          console.log("Found synced account on Supabase. Triggering database sync...");
          const syncSuccess = await syncDatabase();
          console.log("Database sync finished with success status:", syncSuccess);

          return {
            status: "success" as const,
            type: remoteData.type as "employee" | "owner",
            phone: cleanPhone,
            role: remoteData.role,
            name: remoteData.name,
            businessId: remoteData.business_id,
            employeeId: remoteData.employee_id,
          };
        }
      } catch (supabaseErr) {
        console.error("Error checking remote synced account on Supabase:", supabaseErr);
      }

      return {
        status: "register" as const,
        phone: cleanPhone,
      };
    },
    onSuccess: async (data) => {
      if (data.status === "success") {
        useAuthStore.getState().loginWithEmployee(
          data.phone!,
          data.role as any,
          data.name!,
          data.businessId!,
          data.employeeId!
        );
        await useBusinessStore.getState().loadBusinessesFromDb();
        useBusinessStore.getState().setActiveBusiness(data.businessId!);
        
        // Invalidate businesses query cache so it reloads immediately!
        queryClient.invalidateQueries({ queryKey: ["businesses"] });
      }
    },
  });
}

export function useRegisterUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      phone: string;
      businessName: string;
      category: string;
      address: string;
    }) => {
      const { phone, businessName, category, address } = params;
      const db = require("../components/data/db").default;

      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, "");
        if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
        if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
        return cleaned;
      };

      const cleanPhone = normalizePhone(phone);

      let newBizRecord: any;
      let newEmpRecord: any;

      await db.write(async () => {
        newBizRecord = await db.get("businesses").create((biz: any) => {
          biz.name = businessName;
          biz.businessType = category;
          biz.address = address;
          biz.phoneNumber = cleanPhone;
        });

        newEmpRecord = await db.get("employees").create((emp: any) => {
          emp.business.set(newBizRecord);
          emp.name = "Owner / Admin";
          emp.role = "admin";
          emp.phone = cleanPhone;
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
              p.business.set(newBizRecord);
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

      return {
        phone: cleanPhone,
        businessId: newBizRecord.id,
        employeeId: newEmpRecord.id,
      };
    },
    onSuccess: async (data) => {
      useAuthStore.getState().loginWithEmployee(
        data.phone,
        "admin",
        "Owner / Admin",
        data.businessId,
        data.employeeId
      );
      await useBusinessStore.getState().loadBusinessesFromDb();
      useBusinessStore.getState().setActiveBusiness(data.businessId);

      // Invalidate businesses query cache!
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
}
