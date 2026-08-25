# 🔐 Security, Multi-Role & Tenant Isolation Architecture Specification

> **Document Version**: `1.0.0`  
> **Target Audience**: QA Engineering, Security Auditing, Systems Architecture, Development Teams  
> **Scope**: Mobile Client (React Native/Expo), Web Client (Next.js), Supabase Cloud Database (PostgreSQL/RLS)

---

## 📑 Table of Contents
1. [Executive Overview](#1-executive-overview)
2. [Identity & Role Hierarchy](#2-identity--role-hierarchy)
3. [Phone Number Normalization & Uniqueness Rules](#3-phone-number-normalization--uniqueness-rules)
4. [Cross-Tenant Security Boundaries & Edge Cases](#4-cross-tenant-security-boundaries--edge-cases)
5. [Multi-Store / Multi-Outlet Architecture](#5-multi-store--multi-outlet-architecture)
6. [QA Test Scenarios & Acceptance Criteria](#6-qa-test-scenarios--acceptance-criteria)
7. [Database Architecture & RPC Specifications](#7-database-architecture--rpc-specifications)
8. [Role-Based Access Control (RBAC) Matrix](#8-role-based-access-control-rbac-matrix)

---

## 1. Executive Overview

Shopbook POS implements a strict **Multi-Tenant Offline-First Security Architecture**. Data boundaries between distinct business organizations are enforced at multiple levels:
- **Client-Side (Mobile & Web)**: Pre-flight validation, permission guards, and atomic UI restrictions.
- **Local Engine (WatermelonDB)**: Database queries scoped strictly by the active `business_id`.
- **Cloud Backend (PostgreSQL & Supabase)**: Row Level Security (RLS), stored procedures (`SECURITY DEFINER`), and telephone identity registries.

---

## 2. Identity & Role Hierarchy

```
                                ┌───────────────────────────┐
                                │     BUSINESS OWNER        │
                                │   (Global Phone Record)   │
                                └─────────────┬─────────────┘
                                              │ Creates & Manages
                                              ▼
                        ┌───────────────────────────────────────────┐
                        │      Business / Branch / Outlet Entity    │
                        │               (business_id)               │
                        └─────────────┬───────────────┬─────────────┘
                                      │               │
                         Employs Staff│               │Employs Staff
                                      ▼               ▼
                        ┌──────────────────┐    ┌──────────────────┐
                        │     MANAGER      │    │     CASHIER      │
                        │ (Assigned Role)  │    │ (Assigned Role)  │
                        └──────────────────┘    └──────────────────┘
```

### Roles Defined:
1. **Business Owner (Super Admin)**:
   - Registers a business entity using their primary mobile telephone number.
   - Holds administrative ownership across one or multiple businesses/branches.
   - Can register staff, manage catalog items, adjust inventory, view analytics, and generate financial reports.
2. **Manager**:
   - Employed by a Business Owner for an outlet.
   - Authorized to manage stock intake, adjust catalog details, apply billing discounts, and oversee operations.
   - Restricted from deleting businesses or removing other managers.
3. **Cashier**:
   - Authorized strictly for point-of-sale operations (scanning barcodes, managing carts, issuing invoices, collecting cash/card tender, and printing receipts).
   - Restricted from modifying master catalog prices, voiding historical audits without authorization, or managing staff.

---

## 3. Phone Number Normalization & Uniqueness Rules

To eliminate formatting discrepancies (`+9471...`, `071...`, `9471...`, spaces, hyphens), all systems run canonical phone normalization:

### Normalization Logic:
```
Raw Input:  "+94 (71) 71-330-74"  ──►  Strip Non-Digits: "94717133074"
Strip Country Code '94':          ──►  Clean: "717133074"
Strip Leading '0' (if any):       ──►  Canonical 9-Digit Phone: "717133074"
```

### PostgreSQL Normalizer (`normalize_phone_pg`):
```sql
CREATE OR REPLACE FUNCTION public.normalize_phone_pg(phone_str text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
BEGIN
  IF phone_str IS NULL THEN RETURN ''; END IF;
  cleaned := regexp_replace(phone_str, '\D', '', 'g');
  IF cleaned LIKE '94%' THEN cleaned := substr(cleaned, 3); END IF;
  IF cleaned LIKE '0%' THEN cleaned := substr(cleaned, 2); END IF;
  RETURN cleaned;
END;
$$;
```

---

## 4. Cross-Tenant Security Boundaries & Edge Cases

### Rule 1: Business Owner Phone Immutability
A telephone number registered as a **Business Owner** (`businesses.phone_number`) can **NEVER** be registered as a subordinate Employee in any business.

### Rule 2: Inter-Business Cross-Owner Protection
- **Scenario**: Owner A (`071 71 330 74`) owns Business A. Owner B (`071 71 330 75`) owns Business B.
- **Constraint**: Owner B **CANNOT** add Owner A (`071 71 330 74`) as an employee.
- **Behavior**: Cloud RPC `check_phone_registered` detects that `...74` is an Owner record and blocks registration with error: `"This phone number is already registered to an existing business."`

### Rule 3: Cross-Tenant Staff Theft Protection
- **Scenario**: Staff member "Kamal" (`077 12 345 67`) is registered as a Cashier under Owner 1 (Business A).
- **Constraint**: Owner 2 (Business B) **CANNOT** hijack or register Kamal (`077 12 345 67`) to Business B without prior deregistration from Business A.
- **Behavior**: Pre-flight validation intercepts the attempt and alerts: `"This phone number is already registered in the cloud database."`

---

## 5. Multi-Store / Multi-Outlet Architecture

A single Business Owner can operate multiple outlets seamlessly under a single owner identity:

```
                            ┌────────────────────────────────────────┐
                            │    Business Owner (071 71 330 74)      │
                            └───────────────────┬────────────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
     ┌───────────────────────┐      ┌───────────────────────┐      ┌───────────────────────┐
     │  Shopbook - Colombo   │      │   Shopbook - Kandy    │      │   Shopbook - Galle    │
     │     (business_id_1)   │      │     (business_id_2)   │      │     (business_id_3)   │
     └───────────────────────┘      └───────────────────────┘      └───────────────────────┘
```

1. **Owner Authentication**: Logging in via OTP pulls all owned businesses. The Owner switches outlets instantaneously using the Business Switcher UI.
2. **Staff Assignment Across Outlets**:
   - An Owner can assign distinct staff per branch.
   - When staff members are authorized for multiple branches, logging in via `fetch_user_businesses` presents a branch selection prompt, allowing them to select their active workstation.

---

## 6. QA Test Scenarios & Acceptance Criteria

| Scenario ID | Test Description | Input Data | Expected Result | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **TC-SEC-01** | Add new unique staff member | Valid Name, Unique Phone `0771002001`, Role `Cashier` | Record saved to `employees` table. Cloud sync succeeds. | **PASS** if saved and synced. |
| **TC-SEC-02** | Owner attempts to add another Business Owner as staff | Phone `0717133074` (Already registered to Business A) | Blocked with Alert: *"This phone number is already registered to an existing business."* | **PASS** if creation is aborted. |
| **TC-SEC-03** | External Owner attempts to register another business's employee | Phone `0771234567` (Staff under Business A) | Blocked with Alert: *"This phone number is already registered in the cloud database."* | **PASS** if creation is aborted. |
| **TC-SEC-04** | Phone Normalization Verification | Inputs: `+94 77 123 4567`, `077-1234567`, `771234567` | All resolve to canonical `771234567`. Duplicate detection triggers regardless of formatting. | **PASS** if format variations are caught. |
| **TC-SEC-05** | Multi-Business Owner Login | Owner Phone with 3 registered businesses | `fetch_user_businesses` returns array of 3 businesses. UI displays Store Switcher. | **PASS** if all stores accessible. |
| **TC-SEC-06** | Multi-Branch Staff Login | Staff phone assigned to 2 stores under same owner | `fetch_user_businesses` returns 2 stores. Employee selects active store. | **PASS** if staff can select outlet. |
| **TC-SEC-07** | Cashier Permission Boundary | Cashier attempts to access `/profile/manage-staff` | System displays Access Denied banner / prevents navigation. | **PASS** if unauthorized access blocked. |

---

## 7. Database Architecture & RPC Specifications

### 1. `check_phone_registered(input_phone, exclude_employee_id, exclude_business_id)`
- **Execution Mode**: `SECURITY DEFINER` (runs with elevated database authority to audit globally across tables while protecting customer PII).
- **Return Signature**:
  ```json
  {
    "exists": true | false,
    "type": "owner" | "employee",
    "role": "admin" | "manager" | "cashier",
    "name": "string",
    "business_id": "uuid",
    "business_name": "string"
  }
  ```

### 2. `fetch_user_businesses(input_phone)`
- **Purpose**: Authenticates login telephone numbers and returns all valid workspaces (owned or employed).
- **Return Signature**:
  ```json
  {
    "businesses": [
      {
        "id": "uuid",
        "name": "Shopbook Colombo",
        "business_type": "Grocery & Retail",
        "phone_number": "717133074"
      }
    ],
    "employees": [
      {
        "id": "uuid",
        "business_id": "uuid",
        "name": "Kamal Perera",
        "role": "cashier"
      }
    ]
  }
  ```

---

## 8. Role-Based Access Control (RBAC) Matrix

| Capability / Module | Owner / Super Admin | Manager | Cashier |
| :--- | :---: | :---: | :---: |
| **Process POS Checkout & Issue Invoices** | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **Barcode Scanning & Catalog Search** | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **Create / Modify Products & Prices** | ✅ Full Access | ✅ Full Access | ❌ Restricted |
| **Manual Stock In / Inventory Adjustment**| ✅ Full Access | ✅ Full Access | ❌ Restricted |
| **Add / Edit / Remove Staff Members** | ✅ Full Access | ❌ Restricted | ❌ Restricted |
| **Edit Business Profile & Tax Settings** | ✅ Full Access | ❌ Restricted | ❌ Restricted |
| **Switch Active Business Outlet** | ✅ Full Access | ✅ Assigned Only | ✅ Assigned Only |
| **View Financial Sales Ledger & Audits**| ✅ Full Access | ✅ Full Access | ❌ Restricted |

---

## 🛡️ Summary of Architectural Invariants

1. **Zero Data Leakage**: Tenant isolation ensures no merchant or staff can access data outside their authorized `business_id`.
2. **Deterministic Phone Identification**: Normalized 9-digit E.164-compatible formatting prevents duplicate user records and identity spoofing.
3. **Fail-Safe Client Interceptors**: Even in offline states, local WatermelonDB tables execute duplicate pre-checks before writing transactions to the offline queue.
