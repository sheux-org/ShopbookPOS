import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePosBilling } from '../../hooks/usePosBilling';
import { useCart } from '../../stores/cartStore';
import { useSettingsStore } from '../../stores/settingsStore';

// 1. Mock dependencies
vi.mock('../../hooks/useProducts', () => {
  return {
    useProducts: vi.fn().mockReturnValue({
      data: [
        { id: '1', name: 'Pizza', price: 850, stockCount: 10, barcode: '12345', quickCode: '2001' },
        { id: '2', name: 'Burger', price: 690, stockCount: 0, barcode: '67890', quickCode: '2002' },
      ],
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }),
    mapDBProduct: (p: any) => p,
    useFindProduct: () => ({
      findProductByCodeOrName: vi.fn().mockResolvedValue([]),
      findProductByBarcode: vi.fn().mockResolvedValue([]),
    }),
  };
});

vi.mock('../../hooks/useOrders', () => {
  return {
    useCreateOrder: () => ({
      mutateAsync: vi.fn().mockResolvedValue({ invoiceNumber: 'INV-1001' }),
    }),
  };
});

vi.mock('../../hooks/useCartActions', () => {
  return {
    useCartActions: () => {
      const cart = useCart((s) => s.cart);
      const { addCartItem, updateQuantity, clearCart } = useCart.getState();
      return {
        cart,
        addCartItem: (name: string, price: number, icon?: string, sku?: string, stock?: number, toast?: any) => {
          addCartItem(name, price, icon, sku, stock);
        },
        updateQuantity: (id: string, delta: number, toast?: any) => {
          updateQuantity(id, delta);
        },
        clearCart,
      };
    },
  };
});

describe('usePosBilling Hook', () => {
  beforeEach(() => {
    useCart.getState().clearCart();
    useSettingsStore.setState({ posMode: 'normal' });
  });

  test('should calculate subtotal, tax, discounts, and total correctly', () => {
    // 1. Setup cart state
    useCart.setState({
      cart: [
        { id: 'item-1', name: 'Pizza', price: 800, quantity: 2, stock: 10 }, // 1600
        { id: 'item-2', name: 'Drink', price: 200, quantity: 1, stock: 5 },  // 200
      ],
    });

    const { result } = renderHook(() => usePosBilling());

    expect(result.current.subtotal).toBe(1800);

    // 2. Set percentage discount
    act(() => {
      result.current.setTempDiscount('10');
      result.current.setTempDiscountType('percent');
    });
    act(() => {
      result.current.handleSaveDiscount();
    });

    expect(result.current.discountAmount).toBe(180); // 10% of 1800

    // 3. Set tax rate
    act(() => {
      result.current.setTempTaxRate('8');
    });
    act(() => {
      result.current.handleSaveTax();
    });

    expect(result.current.taxAmount).toBe(129.6); // 8% of (1800 - 180 = 1620)
    expect(result.current.totalAmount).toBe(1749.6); // 1620 + 129.6
  });

  test('should calculate flat discounts correctly', () => {
    useCart.setState({
      cart: [{ id: 'item-1', name: 'Pizza', price: 1000, quantity: 1, stock: 10 }],
    });

    const { result } = renderHook(() => usePosBilling());

    act(() => {
      result.current.setTempDiscount('150');
      result.current.setTempDiscountType('flat');
    });
    act(() => {
      result.current.handleSaveDiscount();
    });

    expect(result.current.discountAmount).toBe(150);
    expect(result.current.totalAmount).toBe(850);
  });

  test('should validate payment tender states correctly', () => {
    useCart.setState({
      cart: [{ id: 'item-1', name: 'Pizza', price: 1000, quantity: 1, stock: 10 }],
    });

    const { result } = renderHook(() => usePosBilling());

    // By default, payment is cash and cashReceived is empty -> invalid
    expect(result.current.isPaymentValid).toBe(false);

    // Set sufficient cash received -> valid
    act(() => {
      result.current.setCashReceived('1100');
    });
    expect(result.current.isPaymentValid).toBe(true);
    expect(result.current.changeDue).toBe(100);

    // Switch to card without card brand/last-4 -> invalid
    act(() => {
      result.current.handlePaymentMethodChange('card');
    });
    expect(result.current.isPaymentValid).toBe(false);

    // Fill card details -> valid
    act(() => {
      result.current.setBankName('Sampath Bank');
      result.current.setCardDigits('4321');
    });
    expect(result.current.isPaymentValid).toBe(true);
  });
});
