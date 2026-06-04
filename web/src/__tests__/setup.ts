import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';

// 1. Mock LocalStorage / SessionStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// 2. Mock Navigator APIs
Object.defineProperty(navigator, 'getBattery', {
  value: vi.fn().mockResolvedValue({
    level: 0.85,
    charging: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
  writable: true,
});

Object.defineProperty(navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn().mockImplementation((success) =>
      success({
        coords: {
          latitude: 6.9271,
          longitude: 79.8612,
        },
      })
    ),
    watchPosition: vi.fn(),
  },
  writable: true,
  configurable: true,
});

// Mock online status
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
});

// 3. Mock WatermelonDB & LokiJS completely to avoid native db loading
vi.mock('@nozbe/watermelondb', () => {
  return {
    Model: class {},
    Database: class {
      get = vi.fn().mockReturnValue({
        query: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue([]),
        }),
        create: vi.fn().mockResolvedValue({}),
      });
      write = vi.fn().mockImplementation((cb) => cb());
    },
    Relation: class {},
    appSchema: vi.fn().mockImplementation((config) => config),
    tableSchema: vi.fn().mockImplementation((config) => config),
    Q: {
      where: vi.fn().mockImplementation((col, val) => ({ col, val })),
    },
  };
});

vi.mock('@nozbe/watermelondb/decorators', () => {
  return {
    text: () => () => {},
    field: () => () => {},
    date: () => () => {},
    relation: () => () => {},
    children: () => () => {},
    readonly: () => () => {},
  };
});

vi.mock('@nozbe/watermelondb/adapters/lokijs', () => {
  return {
    default: class {},
  };
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: vi.fn(),
      replace: vi.fn(),
    };
  },
  usePathname() {
    return '';
  },
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => {
  return {
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
    useMutation: vi.fn().mockImplementation(() => ({
      mutateAsync: vi.fn().mockResolvedValue({ invoiceNumber: 'INV-1001' }),
    })),
  };
});

// Mock Database globally
vi.mock('../db/database');

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  });

  return {
    createClient: vi.fn().mockReturnValue({
      from: mockFrom,
      rpc: vi.fn().mockResolvedValue({ data: { exists: false }, error: null }),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        send: vi.fn().mockResolvedValue({}),
      }),
      removeChannel: vi.fn().mockResolvedValue({}),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi
            .fn()
            .mockReturnValue({ data: { publicUrl: 'https://placeholder.logo' } }),
        }),
      },
    }),
  };
});

// Reset mocks before each test
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});
