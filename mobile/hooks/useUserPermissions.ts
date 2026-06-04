import { useAuthStore } from '../stores/useAuthStore';

export type UserRole = 'admin' | 'manager' | 'cashier';
export type PermissionAction = 'create' | 'read' | 'update' | 'delete';
export type PermissionResource = 'products' | 'transactions' | 'staff' | 'settings' | 'sync';

// Professional Enterprise RBAC Matrix Mapping
const PERMISSION_MATRIX: Record<UserRole, Record<PermissionResource, PermissionAction[]>> = {
  admin: {
    products: ['create', 'read', 'update', 'delete'],
    transactions: ['create', 'read', 'update', 'delete'],
    staff: ['create', 'read', 'update', 'delete'],
    settings: ['create', 'read', 'update', 'delete'],
    sync: ['create', 'read', 'update', 'delete'],
  },
  manager: {
    products: ['create', 'read', 'update'], // Managers cannot DELETE products
    transactions: ['create', 'read'], // Managers cannot delete/alter sales transactions
    staff: [], // Managers cannot access or manage staff list
    settings: ['read'], // Managers can view, but not configure store settings
    sync: ['create', 'read', 'update'], // Managers can trigger cloud synchronizations
  },
  cashier: {
    products: ['read'], // Cashiers can ONLY view/scan items to add to cart
    transactions: ['create', 'read'], // Cashiers can checkout sales and view current invoice
    staff: [], // Cashiers have zero staff panel access
    settings: [], // Cashiers have zero store settings access
    sync: [], // Cashiers cannot trigger cloud database syncs
  },
};

export const useUserPermissions = () => {
  // Retrieve the currently active session role from the AuthStore
  const userRoleRaw = useAuthStore((s: any) => s.userRole) || 'admin';

  // Normalise role string to match matrix keys
  const role: UserRole =
    userRoleRaw === 'admin' || userRoleRaw === 'manager' || userRoleRaw === 'cashier'
      ? (userRoleRaw as UserRole)
      : 'cashier';

  /**
   * Evaluates if the current employee session role is authorized to perform the CRUD action.
   *
   * @param action The operation to test: 'create' | 'read' | 'update' | 'delete'
   * @param resource The workspace component: 'products' | 'transactions' | 'staff' | 'settings' | 'sync'
   */
  const canPerform = (action: PermissionAction, resource: PermissionResource): boolean => {
    const allowedActions = PERMISSION_MATRIX[role]?.[resource] || [];
    return allowedActions.includes(action);
  };

  /**
   * Helper to evaluate hierarchical role levels (e.g. if an element requires at least 'manager' level).
   */
  const isRoleAtLeast = (minRole: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      cashier: 1,
      manager: 2,
      admin: 3,
    };
    return (roleHierarchy[role] || 1) >= (roleHierarchy[minRole] || 1);
  };

  return {
    role,
    canPerform,
    isRoleAtLeast,
  };
};
