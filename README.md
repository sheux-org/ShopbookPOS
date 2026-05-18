# Shopbook POS (Point of Sale) 📱🛒

Welcome to the **Shopbook POS** mobile application. This is a high-fidelity, ultra-premium tablet and mobile Point-of-Sale interface designed for modern retail environments. Built with Expo, React Native, and Expo Router, it features an advanced modular structure, type-safe architecture, and a streamlined, responsive checkout workflow.

---

## 🌟 Key Features

* **Unified Global Bottom Tab Navigation**: Natively integrated bottom navigation with smooth tab transition.
* **Ultra-Premium Compact POS Keyboard**: Restructured keypads, compact quick-code inputs, and summary action triggers that maximize cart item scrollable area (saving over `110px` of vertical height).
* **Interactive Scan Viewport**: Instant simulated viewfinder acting as the default state for high-volume scanning environments.
* **Clean Checkout flow**: Sleek multi-step payment tender interfaces including Cash and upgraded Card options.

---

## 🏗️ Project Architecture & Directory Structure

The application's routing is powered by **Expo Router v3**, using file-based group directory mapping. This separates concerns cleanly without affecting URL path stability.

```text
app/
├── (tabs)/                  # Main Application Tabs (ignores group in path)
│   ├── _layout.tsx          # Native TabLayout using custom BottomTabBar mapping
│   ├── index.tsx            # / -> Home Screen
│   ├── pos.tsx              # /pos -> POS Interface
│   ├── stocks.tsx           # /stocks -> Stock Registry
│   └── profile.tsx          # /profile -> Cashier Profile
│
├── (pos)/                   # POS & Checkout Standalone Screens
│   ├── cart.tsx             # /cart -> Customer Cart View
│   ├── catalog.tsx          # /catalog -> Product Directory Catalog
│   ├── payment.tsx          # /payment -> Payment Selector
│   ├── payment-tender.tsx   # /payment-tender -> Payment Processing (Sunmi POS card terminal simulator)
│   └── search.tsx           # /search -> Global Product Search
│
├── (stocks)/                # Inventory Registry Screens
│   ├── add-item.tsx         # /add-item -> Add New Products to Register
│   └── scan.tsx             # /scan -> Dedicated Camera Scanner View
│
└── _layout.tsx              # Application Root Stack Layout
```

> [!NOTE]
> Parenthesis groups like `(pos)` and `(stocks)` are automatically ignored in the router paths. Navigation calls (e.g. `router.push("/cart")` or `router.push("/add-item")`) remain stable, standard, and fully decoupled from folder location.

---

## 🛠️ Technology Stack

1. **Framework**: Expo (React Native) with Expo Router (File-based Routing).
2. **Package Manager**: **pnpm** (Fast, disk-efficient, and strictly typed node_modules resolution).
3. **State Management**: Reactive cart sync engine.
4. **Icons**: Vector Icons (Feather, Ionicons).

---

## 🚀 Getting Started

Ensure you have [Node.js](https://nodejs.org/) installed. We strictly use **pnpm** in this project.

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start the App
```bash
pnpm start
```
* Press `i` to open in the **iOS Simulator**.
* Press `a` to open in the **Android Emulator**.
* Scan the QR code using the **Expo Go** app on your physical tablet or mobile phone.

### 3. Verify Type Safety
```bash
pnpm tsc --noEmit
```

---

## 🎨 Premium UI Styles & Tokens

The application uses a custom design system mapped in `constants/theme.ts`:
* **Primary Blue**: Premium accenting for POS action triggers.
* **Sunmi Accents**: High-contrast indicator states mimicking professional Sunmi terminal interfaces.
* **Modern Typography**: Elegant and bold weights optimized for quick-glance checkout cashiers.
