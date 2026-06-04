# Testing Guide

This guide describes the testing framework, infrastructure, scripts, and best practices for writing and maintaining tests in the **Shopbook POS Web Terminal** application.

---

## 1. Testing Stack & Tools

The project uses a modern testing stack tailored for React and Vite:

- **Test Runner**: [Vitest](https://vitest.dev) - A blazing fast unit test framework powered by Vite.
- **Environment**: [jsdom](https://github.com/jsdom/jsdom) - A pure-JavaScript implementation of web standards for testing browser behavior.
- **Component Testing**: [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) - Light-weight utility for testing React components without relying on implementation details.
- **Assertions & Mocks**: Vitest's built-in Jest-compatible APIs (`describe`, `test`, `expect`, `vi`).

---

## 2. Running Tests

Navigate to the `web` workspace directory and run the following scripts using your package manager:

```bash
# Run all test cases once
pnpm test

# Run tests in watch/interactive development mode
pnpm test:watch

# Run all test cases and generate a coverage report
pnpm test:coverage
```

Test coverage results will be output to the console and a detailed HTML report will be generated inside the `web/coverage/` directory.

---

## 3. Test Configuration & Setup

### A. Main Configuration

The main test environment is configured in [vitest.config.ts](../vitest.config.ts). It sets up Vite plugins (React), registers the `jsdom` testing environment, resolves custom import paths (`@/*`), and includes a global setup file.

### B. Global Mocks & Browser Environment

Testing in a Node.js environment requires mocking browser APIs, native database drivers, and cloud APIs. This is managed in [setup.ts](../src/__tests__/setup.ts):

1. **LocalStorage / SessionStorage Mocks**: Custom key-value stores that mock `window.localStorage` and `window.sessionStorage` behaviors dynamically.
2. **Navigator APIs**:
   - Geolocation (`navigator.geolocation` resolved to standard Colombo, Sri Lanka coordinates).
   - Battery Status (`navigator.getBattery`).
   - Connection status (`navigator.onLine` mocked to `true` by default).
3. **Database Driver Mocks**: WatermelonDB and LokiJS are fully mocked in [setup.ts](../src/__tests__/setup.ts) to prevent vitest from compiling or loading binary database adapters during Node execution.
4. **Third-Party Mocks**:
   - `next/navigation`: Mocked to stub `useRouter` (returning mock navigation actions) and `usePathname`.
   - `@tanstack/react-query`: Mocked to stub mutations and invalidate caching calls.
   - `@supabase/supabase-js`: Mocked globally to return stubbed database selections/updates and prevent actual network requests to your staging tables.

### C. Database Fallbacks & Dynamic Query Mocking

To mock database collections (like `products`, `businesses`, `orders`) dynamically inside tests, use the mocked database module:

- **Location**: [database.ts](../src/db/__mocks__/database.ts)
- **Usage**: Exported stub database mock features like custom fetch queries (`mockFetch`) and record creation callbacks. You can import `databaseMock` directly in tests to verify database write hooks.

---

## 4. Test Directory Structure

All test cases are located inside the `web/src/__tests__/` directory. The test files mirror the folder hierarchy of the application source code:

```text
web/src/__tests__/
├── api/             # API connection tests (e.g., authApi.test.ts)
├── components/      # UI components tests (e.g., Scanner.test.tsx, TotalsSummary.test.tsx)
├── db/              # Database mock test coverages
├── hooks/           # Custom React hook tests (e.g., usePosBilling.test.ts)
├── services/        # Offline queue & synchronization logic tests
├── stores/          # Zustand state store tests (e.g., cartStore.test.ts, authStore.test.ts)
└── setup.ts         # Global test environment setups & mocks
```

---

## 5. Writing New Test Cases

When creating new features, follow these guidelines to add corresponding test coverage.

### A. Zustand Store Testing

Ensure store tests reset the state `beforeEach` to prevent cross-test leakage.

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { useCartStore } from '../../stores/cartStore';

describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  test('should add items to the cart', () => {
    const { addItem } = useCartStore.getState();
    addItem({ id: 'prod_1', name: 'Product A', price: 100 }, 2);

    expect(useCartStore.getState().items.length).toBe(1);
    expect(useCartStore.getState().items[0].quantity).toBe(2);
  });
});
```

### B. Custom React Hooks Testing

Use `renderHook` from `@testing-library/react` to test reactive hooks without rendering full visual DOMs.

```typescript
import { renderHook, act } from '@testing-library/react';
import { useActiveDeviceTracker } from '../../hooks/useActiveDeviceTracker';

test('should track active devices and schedule ping interval', () => {
  const { result } = renderHook(() => useActiveDeviceTracker('business_1', 'user_1'));

  // Assert hook outputs
  expect(result.current.isRegistered).toBe(true);
});
```

### C. Component Testing

Render components and fire user interaction events to assert UI behaviors.

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TotalsSummary from '../../components/pos/TotalsSummary';

test('should calculate summary totals correctly', async () => {
  render(<TotalsSummary subtotal={1000} discount={100} tax={50} />);

  const totalText = screen.getByText('LKR 950.00');
  expect(totalText).toBeInTheDocument();
});
```

### D. Service & Synchronization Testing

Test network sync functions by mocking remote RPC responses and asserting database sync execution status or console log interceptors:

```typescript
import { describe, test, expect, vi } from 'vitest';
import { syncDatabase, supabase } from '../../services/sync';

test('should handle network/offline errors gracefully with console.warn', async () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  // Simulate network fetch failure
  supabase.rpc = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

  const success = await syncDatabase();
  expect(success).toBe(false);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('network connectivity issues'));

  warnSpy.mockRestore();
});
```

---

## 6. Maintenance Guidelines for Future Developers

To keep the application stable as features grow:

- **Run Tests Locally**: Always run `npm run test` before creating a pull request or pushing updates.
- **Continuous Integration**: Ensure all mock responses inside [setup.ts](../src/__tests__/setup.ts) match your model interface upgrades.
- **Act Wrappers**: Wrap any state changes inside test utilities with `act(() => { ... })` helper functions to avoid React DOM update warning alerts in test outputs.
