# Role & Staff Management Architecture

This document details the Role-Based Access Control (RBAC) and Staff Management implementation in **Shopbook Mini POS**. The system is built on top of a local SQLite database (via **WatermelonDB**), synchronized with a **Supabase** backend, and managed via React Query and Zustand stores.

---

## 1. Role Definitions

Shopbook Mini POS recognizes three primary employee roles, each carrying a different level of trust and operational scope:

| UI Role | DB Value (`employees.role`) | Target User | Description |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | Store Owner / Master Administrator | Complete control over the store, inventory, settings, subscription, and staff permissions. |
| **Manager** | `manager` | Store Manager | Authorized to manage stock catalogs and initiate data synchronization. Excluded from staff and store configuration settings. |
| **Cashier** | `cashier` | Cash Register Operator | Restricted to register sales (checkout) and scan/view products. Zero configuration or catalog alteration rights. |

---

## 2. RBAC Permission Matrix

System access rules are configured using a structured matrix mapping roles to actions (`create`, `read`, `update`, `delete`) on key system resources.

The matrix configuration is located in [useUserPermissions.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/hooks/useUserPermissions.ts):

```typescript
const PERMISSION_MATRIX: Record<
  UserRole,
  Record<PermissionResource, PermissionAction[]>
> = {
  admin: {
    products: ["create", "read", "update", "delete"],
    transactions: ["create", "read", "update", "delete"],
    staff: ["create", "read", "update", "delete"],
    settings: ["create", "read", "update", "delete"],
    sync: ["create", "read", "update", "delete"],
  },
  manager: {
    products: ["create", "read", "update"], // Cannot DELETE products
    transactions: ["create", "read"],       // Cannot delete/alter transactions
    staff: [],                              // Cannot manage staff lists
    settings: ["read"],                     // Can view, but not edit settings
    sync: ["create", "read", "update"],     // Can sync with the cloud
  },
  cashier: {
    products: ["read"],                     // Can ONLY scan/read products
    transactions: ["create", "read"],       // Can checkout sales & view invoices
    staff: [],                              // No staff management access
    settings: [],                           // No settings access
    sync: [],                               // No cloud sync capabilities
  },
};
```

---

## 3. Enforcement Mechanisms

Enforcement of user permissions occurs at multiple levels of the application:

### A. Bottom Navigation Bar Customization
In [BottomTabBar.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/common/BottomTabBar.tsx), tabs are filtered dynamically depending on permissions. For example, if a cashier does not possess `update` permissions on `products`, the **Stocks** tab is hidden entirely from their bottom bar. Additionally, Cashiers see the **Orders** tab, while Admins/Managers see **Insights**.

### B. Settings Screen Visibility
In [ProfileScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/ProfileScreen.tsx):
- **Staff Management** navigation is only displayed to users with `create` permission for `staff` (Admins).
- **Payments Setup** and **Premium Plans** are only shown to users with `create` permission for `settings` (Admins).
- **Auto Backup & Sync** configuration controls are hidden for cashiers, as they lack `read` permission for `sync`.

### C. Screen-Level Route Guarding
Even if a cashier accesses a restricted module directly:
- **Stocks Screen** ([StocksScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/StocksScreen.tsx)): Evaluates `canPerform("create", "products")`. If unauthorized, it renders an `"Inventory Operations Restricted"` card lock UI blocking catalog modification form fields.
- **Business Details** ([business-details.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/app/(modules)/profile/business-details.tsx)): Guards edit actions by checking `canPerform("update", "settings")` and throws route-level block alerts or hides submit actions.
- **Branch Management** ([manage-businesses.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/app/(modules)/profile/manage-businesses.tsx)): Checks `canPerform("create", "settings")` before allowing branch registration.

---

## 4. Auth & Session Management

Session persistence is handled via Zustand ([useAuthStore.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/stores/useAuthStore.ts)), which stores the active session, user, and `userRole` inside local AsyncStorage.

### Verification Flow (OTP Login)

When logging in ([useAuth.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/hooks/useAuth.ts)):
1. **Local Employee Match**: The input phone number is normalized and queried against the local WatermelonDB `employees` table. If matched, the employee logs in with their designated role and `businessId`.
2. **Local Owner Match**: If no employee matches, the system queries the local `businesses` table. If the phone number matches the primary business number, they log in as **Admin / Store Owner**.
3. **Supabase Check (Remote Check)**: If the phone number is not found locally (e.g. fresh device install), the app calls the Supabase RPC function `check_synced_account` with the input number:
   - If a synced remote account exists, the app triggers a complete table pull sync (`syncDatabase()`) to retrieve all local assets (products, orders, employees).
   - Once pulled, they log in with their synced role.
4. **Register**: If no records match, the app prompts them to register a new store branch (implicitly designating the creator as the Owner/Admin).

---

## 5. Staff Management Lifecycle (Step-by-Step)

The administration of staff records is facilitated inside the [ManageStaffRoute](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/app/(modules)/profile/manage-staff.tsx) screen using local database mutations defined in [useStaff.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/hooks/useStaff.ts).

### Step 1: Normalizing Inputs
When adding or updating staff details, phone numbers are automatically cleaned to ensure consistent lookup matches:
- Non-digits are removed.
- Leading Country Codes (`94` for Sri Lanka) or local zero prefixes (`0`) are trimmed off (e.g., `+94 77 987 6543` becomes `779876543`).
- If no email is provided, the database falls back to `no-email@shopbook.lk`.

### Step 2: Creating a Staff Member
Admins can tap the **Add Staff Member** (`+`) button to trigger a bottom drawer form:
1. Input Name, Role (Admin, Manager, Cashier), Phone Number, and Optional Email.
2. Under the hood, WatermelonDB inserts a record in the `employees` collection:
   ```typescript
   await database.get("employees").create((emp: any) => {
     emp.business.set(dbBiz);
     emp.name = name;
     emp.role = dbRole; // 'admin' | 'manager' | 'cashier'
     emp.phone = cleanPhone;
     emp.email = email;
   });
   ```
3. React Query invalidates the `["staff", businessId]` query key to refresh the staff list.

### Step 3: Modifying Staff Permissions / Info
Admins can tap the **Edit** icon next to any employee card to open the **Edit Staff Details** sheet:
- Admins can modify the staff member's Name, Email, Phone, or **escalate/demote their role**.
- Changes are written to the SQLite DB, instantly updating access rights the next time that employee logs in or when permissions are re-evaluated from the cache.

### Step 4: Deleting / De-authorizing Staff
Admins can tap the **Trash** icon to permanently revoke a staff member's access:
- After user confirmation, the system executes `targetEmp.destroyPermanently()` in SQLite.
- The staff member is immediately removed from the authorized database and won't be able to bypass the OTP check on their device.
