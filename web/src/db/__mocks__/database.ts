import { vi } from 'vitest';

export const mockFetch = vi.fn().mockResolvedValue([]);
export const mockCreate = vi.fn().mockResolvedValue({});
export const mockUpdate = vi.fn().mockResolvedValue({});
export const mockDestroy = vi.fn().mockResolvedValue({});

// Active store databases to hold dynamic query return stubs
export const collections: Record<string, any> = {
  businesses: {
    query: vi.fn().mockReturnValue({
      fetch: mockFetch,
    }),
    create: mockCreate,
  },
  employees: {
    query: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue([]),
    }),
    create: mockCreate,
  },
  products: {
    query: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue([]),
    }),
    create: mockCreate,
  },
  orders: {
    query: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue([]),
    }),
    create: mockCreate,
  },
};

const databaseMock = {
  get: vi.fn().mockImplementation((tableName: string) => {
    return (
      collections[tableName] || {
        query: vi.fn().mockReturnValue({ fetch: vi.fn().mockResolvedValue([]) }),
        create: vi.fn().mockResolvedValue({}),
      }
    );
  }),
  write: vi.fn().mockImplementation((cb) => cb()),
};

export default databaseMock;
export const schema = { version: 8 };
