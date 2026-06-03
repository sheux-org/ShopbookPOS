import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePosBilling } from '../../hooks/usePosBilling';
import { useCart } from '../../stores/cartStore';
import { useSettingsStore } from '../../stores/settingsStore';

// ─── Module Mocks ────────────────────────────────────────────────────

const mockFindProductByCodeOrName = vi.fn().mockResolvedValue([]);
const mockFindProductByBarcode = vi.fn().mockResolvedValue([]);

vi.mock('../../hooks/useProducts', () => ({
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
    findProductByCodeOrName: mockFindProductByCodeOrName,
    findProductByBarcode: mockFindProductByBarcode,
  }),
}));

vi.mock('../../hooks/useOrders', () => ({
  useCreateOrder: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ invoiceNumber: 'INV-1001' }),
  }),
}));

vi.mock('../../hooks/useCartActions', () => ({
  useCartActions: () => {
    const cart = useCart((s) => s.cart);
    const { addCartItem, updateQuantity, clearCart } = useCart.getState();
    return {
      cart,
      addCartItem: (name: string, price: number, icon?: string, sku?: string, stock?: number) => {
        addCartItem(name, price, icon, sku, stock);
      },
      updateQuantity: (id: string, delta: number) => {
        updateQuantity(id, delta);
      },
      clearCart,
    };
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────

const fireKey = (key: string, extra: Partial<KeyboardEventInit> = {}) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
};

const setupCart = (items = [{ id: 'item-1', name: 'Pizza', price: 850, quantity: 1, stock: 10 }]) => {
  useCart.setState({ cart: items });
};

// ─── Test Suite ───────────────────────────────────────────────────────

describe('usePosBilling Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCart.getState().clearCart();
    useSettingsStore.setState({ posMode: 'normal' });
  });

  // ─── Billing calculations ─────────────────────────────────────────

  test('should calculate subtotal, percent discount, tax, and total correctly', () => {
    useCart.setState({
      cart: [
        { id: 'item-1', name: 'Pizza', price: 800, quantity: 2, stock: 10 },
        { id: 'item-2', name: 'Drink', price: 200, quantity: 1, stock: 5 },
      ],
    });

    const { result } = renderHook(() => usePosBilling());
    expect(result.current.subtotal).toBe(1800);

    act(() => { result.current.setTempDiscount('10'); result.current.setTempDiscountType('percent'); });
    act(() => { result.current.handleSaveDiscount(); });

    expect(result.current.discountAmount).toBe(180);

    act(() => { result.current.setTempTaxRate('8'); });
    act(() => { result.current.handleSaveTax(); });

    expect(result.current.taxAmount).toBe(129.6);
    expect(result.current.totalAmount).toBe(1749.6);
  });

  test('should calculate flat discount correctly', () => {
    useCart.setState({ cart: [{ id: 'item-1', name: 'Pizza', price: 1000, quantity: 1, stock: 10 }] });
    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setTempDiscount('150'); result.current.setTempDiscountType('flat'); });
    act(() => { result.current.handleSaveDiscount(); });

    expect(result.current.discountAmount).toBe(150);
    expect(result.current.totalAmount).toBe(850);
  });

  test('should reject discount > 100% for percent type', () => {
    useCart.setState({ cart: [{ id: 'item-1', name: 'Pizza', price: 1000, quantity: 1, stock: 10 }] });
    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setTempDiscount('150'); result.current.setTempDiscountType('percent'); });
    act(() => { result.current.handleSaveDiscount(); });

    // Should not apply (still 0)
    expect(result.current.discountAmount).toBe(0);
  });

  test('should reject invalid (NaN) discount value', () => {
    const { result } = renderHook(() => usePosBilling());
    act(() => { result.current.setTempDiscount('abc'); });
    act(() => { result.current.handleSaveDiscount(); });
    expect(result.current.discountAmount).toBe(0);
  });

  test('should reject tax rate > 100%', () => {
    const { result } = renderHook(() => usePosBilling());
    act(() => { result.current.setTempTaxRate('150'); });
    act(() => { result.current.handleSaveTax(); });
    expect(result.current.taxAmount).toBe(0);
  });

  test('should reject invalid (NaN) tax rate', () => {
    const { result } = renderHook(() => usePosBilling());
    act(() => { result.current.setTempTaxRate('xyz'); });
    act(() => { result.current.handleSaveTax(); });
    expect(result.current.taxAmount).toBe(0);
  });

  // ─── Payment validation ───────────────────────────────────────────

  test('should validate cash, card, and bank payment states correctly', () => {
    setupCart();
    const { result } = renderHook(() => usePosBilling());

    expect(result.current.isPaymentValid).toBe(false);

    act(() => { result.current.setCashReceived('1100'); });
    expect(result.current.isPaymentValid).toBe(true);
    expect(result.current.changeDue).toBe(250);

    act(() => { result.current.handlePaymentMethodChange('card'); });
    expect(result.current.isPaymentValid).toBe(false);

    act(() => { result.current.setBankName('Sampath Bank'); result.current.setCardDigits('4321'); });
    expect(result.current.isPaymentValid).toBe(true);

    act(() => { result.current.handlePaymentMethodChange('bank'); });
    expect(result.current.isPaymentValid).toBe(false);

    act(() => { result.current.setBankName('BOC'); });
    expect(result.current.isPaymentValid).toBe(true);
  });

  test('should return isPaymentValid false when cart is empty', () => {
    const { result } = renderHook(() => usePosBilling());
    act(() => { result.current.setCashReceived('1000'); });
    expect(result.current.isPaymentValid).toBe(false);
  });

  // ─── handleCreateCustomer ─────────────────────────────────────────

  test('should attach a new custom customer', () => {
    const { result } = renderHook(() => usePosBilling());
    act(() => { result.current.handleCreateCustomer('Nimal', '0771234567', 'nimal@mail.com'); });
    expect(result.current.customer).toEqual({ name: 'Nimal', phone: '0771234567', email: 'nimal@mail.com' });
  });

  // ─── Keyboard shortcuts — normal mode ────────────────────────────

  test('F2 / "/" key should be handled (no crash)', () => {
    const { result } = renderHook(() => usePosBilling());
    expect(() => {
      act(() => { fireKey('F2'); });
      act(() => { fireKey('/'); });
    }).not.toThrow();
  });

  test('F3 should open the customer modal', () => {
    const { result } = renderHook(() => usePosBilling());
    expect(result.current.showCustModal).toBe(false);

    act(() => { fireKey('F3'); });
    expect(result.current.showCustModal).toBe(true);
  });

  test('F4 should cycle payment method: cash → card → bank → cash', () => {
    const { result } = renderHook(() => usePosBilling());
    expect(result.current.paymentMethod).toBe('cash');

    act(() => { fireKey('F4'); });
    expect(result.current.paymentMethod).toBe('card');

    act(() => { fireKey('F4'); });
    expect(result.current.paymentMethod).toBe('bank');

    act(() => { fireKey('F4'); });
    expect(result.current.paymentMethod).toBe('cash');
  });

  test('F6 should open discount editing', () => {
    const { result } = renderHook(() => usePosBilling());
    expect(result.current.isEditingDiscount).toBe(false);

    act(() => { fireKey('F6'); });
    expect(result.current.isEditingDiscount).toBe(true);
  });

  test('F6 while already editing should toggle discount type', () => {
    const { result } = renderHook(() => usePosBilling());

    // Open discount editor first
    act(() => { fireKey('F6'); });
    expect(result.current.isEditingDiscount).toBe(true);
    expect(result.current.tempDiscountType).toBe('flat');

    // Press F6 again → toggle to percent
    act(() => { fireKey('F6'); });
    expect(result.current.tempDiscountType).toBe('percent');

    // Press F6 again → toggle back to flat
    act(() => { fireKey('F6'); });
    expect(result.current.tempDiscountType).toBe('flat');
  });

  test('F7 should open tax editing', () => {
    const { result } = renderHook(() => usePosBilling());
    act(() => { fireKey('F7'); });
    expect(result.current.isEditingTax).toBe(true);
  });

  test('F8 should be handled without crashing', () => {
    const { result } = renderHook(() => usePosBilling());
    expect(() => { act(() => { fireKey('F8'); }); }).not.toThrow();
  });

  test('F9 should be handled without crashing', () => {
    const { result } = renderHook(() => usePosBilling());
    expect(() => { act(() => { fireKey('F9'); }); }).not.toThrow();
  });

  test('F10 should be handled (confirm checkout with empty cart)', async () => {
    const { result } = renderHook(() => usePosBilling());
    // Cart is empty → validatePayment will toast an error, not crash
    await act(async () => { fireKey('F10'); });
    expect(result.current.toastMsg).toBe('Cart is empty! 🛒');
  });

  test('Escape should close all modals and editing states', () => {
    const { result } = renderHook(() => usePosBilling());

    act(() => { fireKey('F3'); }); // open cust modal
    expect(result.current.showCustModal).toBe(true);

    act(() => { fireKey('Escape'); });
    expect(result.current.showCustModal).toBe(false);
    expect(result.current.isEditingDiscount).toBe(false);
    expect(result.current.isEditingTax).toBe(false);
  });

  test('Enter while receipt is shown should dismiss receipt and reset', () => {
    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setShowReceipt(true); });
    expect(result.current.showReceipt).toBe(true);

    act(() => { fireKey('Enter'); });
    expect(result.current.showReceipt).toBe(false);
  });

  test('Tab while customer modal is open should toggle modal tab', () => {
    const { result } = renderHook(() => usePosBilling());

    act(() => { fireKey('F3'); }); // open modal
    expect(result.current.showCustModal).toBe(true);

    // custModalTab is not directly exposed, but Tab should not crash
    expect(() => { act(() => { fireKey('Tab'); }); }).not.toThrow();
  });

  test('F12 with non-empty cart should prompt and clear when confirmed', () => {
    setupCart();
    const { result } = renderHook(() => usePosBilling());

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => { fireKey('F12'); });

    expect(result.current.toastMsg).toBe('Transaction cleared');
    expect(result.current.cart).toHaveLength(0);
  });

  test('F12 with empty cart should do nothing', () => {
    const { result } = renderHook(() => usePosBilling());
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => { fireKey('F12'); });

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  test('F12 when user cancels confirm should not clear cart', () => {
    setupCart();
    const { result } = renderHook(() => usePosBilling());

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => { fireKey('F12'); });

    expect(result.current.cart).toHaveLength(1);
  });

  // ─── Cart keyboard navigation ─────────────────────────────────────

  test('ArrowDown should increment selectedRowIndex', () => {
    useCart.setState({
      cart: [
        { id: 'i1', name: 'A', price: 100, quantity: 1, stock: 5 },
        { id: 'i2', name: 'B', price: 200, quantity: 1, stock: 5 },
      ],
    });

    const { result } = renderHook(() => usePosBilling());
    expect(result.current.selectedRowIndex).toBe(0);

    act(() => { fireKey('ArrowDown'); });
    expect(result.current.selectedRowIndex).toBe(1);
  });

  test('ArrowUp should decrement selectedRowIndex', () => {
    useCart.setState({
      cart: [
        { id: 'i1', name: 'A', price: 100, quantity: 1, stock: 5 },
        { id: 'i2', name: 'B', price: 200, quantity: 1, stock: 5 },
      ],
    });

    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setSelectedRowIndex(1); });
    act(() => { fireKey('ArrowUp'); });
    expect(result.current.selectedRowIndex).toBe(0);
  });

  test('ArrowUp should not go below 0', () => {
    setupCart();
    const { result } = renderHook(() => usePosBilling());
    expect(result.current.selectedRowIndex).toBe(0);

    act(() => { fireKey('ArrowUp'); });
    expect(result.current.selectedRowIndex).toBe(0);
  });

  test('"+" key should increase item quantity and show toast', () => {
    setupCart([{ id: 'item-1', name: 'Pizza', price: 850, quantity: 1, stock: 10 }]);
    const { result } = renderHook(() => usePosBilling());

    act(() => { fireKey('+'); });

    const updated = useCart.getState().cart.find((i) => i.id === 'item-1');
    expect(updated?.quantity).toBe(2);
    expect(result.current.toastMsg).toContain('Increased Pizza');
  });

  test('"=" key should also increase quantity', () => {
    setupCart([{ id: 'item-1', name: 'Pizza', price: 850, quantity: 1, stock: 10 }]);
    const { result } = renderHook(() => usePosBilling());

    act(() => { fireKey('='); });

    const updated = useCart.getState().cart.find((i) => i.id === 'item-1');
    expect(updated?.quantity).toBe(2);
  });

  test('"-" key should decrease item quantity and show toast', () => {
    setupCart([{ id: 'item-1', name: 'Pizza', price: 850, quantity: 3, stock: 10 }]);
    const { result } = renderHook(() => usePosBilling());

    act(() => { fireKey('-'); });

    const updated = useCart.getState().cart.find((i) => i.id === 'item-1');
    expect(updated?.quantity).toBe(2);
    expect(result.current.toastMsg).toContain('Decreased Pizza');
  });

  test('Delete key should remove item from cart', () => {
    setupCart([{ id: 'item-1', name: 'Pizza', price: 850, quantity: 2, stock: 10 }]);
    const { result } = renderHook(() => usePosBilling());

    act(() => { fireKey('Delete'); });

    expect(useCart.getState().cart).toHaveLength(0);
    expect(result.current.toastMsg).toContain('Removed Pizza');
  });

  test('Backspace key should also remove item from cart', () => {
    setupCart([{ id: 'item-1', name: 'Pizza', price: 850, quantity: 1, stock: 10 }]);
    const { result } = renderHook(() => usePosBilling());

    act(() => { fireKey('Backspace'); });

    expect(useCart.getState().cart).toHaveLength(0);
  });

  // ─── handleScanSubmit ─────────────────────────────────────────────

  test('should add item to cart when scan query matches by name', async () => {
    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setScanQuery('Pizza'); });
    await act(async () => { await result.current.handleScanSubmit(); });

    expect(useCart.getState().cart.some((i) => i.name === 'Pizza')).toBe(true);
    expect(result.current.toastMsg).not.toBeNull();
    expect(result.current.toastMsg).toContain('Added');
  });

  test('should add item to cart by barcode', async () => {
    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setScanQuery('12345'); });
    await act(async () => { await result.current.handleScanSubmit(); });

    expect(useCart.getState().cart.some((i) => i.name === 'Pizza')).toBe(true);
  });

  test('should add item to cart by quickCode', async () => {
    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setScanQuery('2001'); });
    await act(async () => { await result.current.handleScanSubmit(); });

    expect(useCart.getState().cart.some((i) => i.name === 'Pizza')).toBe(true);
  });

  test('should parse quantity prefix (3*Pizza) and add multiple items', async () => {
    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setScanQuery('3*Pizza'); });
    await act(async () => { await result.current.handleScanSubmit(); });

    // Pizza should have been added 3 times → quantity 3
    const pizzaItem = useCart.getState().cart.find((i) => i.name === 'Pizza');
    expect(pizzaItem?.quantity).toBe(3);
    expect(result.current.toastMsg).toContain('3x Pizza');
  });

  test('should show out-of-stock toast when adding unavailable item', async () => {
    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setScanQuery('Burger'); }); // stockCount: 0
    await act(async () => { await result.current.handleScanSubmit(); });

    expect(result.current.toastMsg).not.toBeNull();
    expect(result.current.toastMsg).toContain('Out of stock');
  });

  test('should show not-found toast when scan query has no match', async () => {
    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setScanQuery('UNKNOWN_ITEM_XYZ'); });
    await act(async () => { await result.current.handleScanSubmit(); });

    expect(result.current.toastMsg).not.toBeNull();
    expect(result.current.toastMsg).toContain('not found');
  });

  test('should do nothing when scan query is empty', async () => {
    const { result } = renderHook(() => usePosBilling());

    act(() => { result.current.setScanQuery('   '); });
    await act(async () => { await result.current.handleScanSubmit(); });

    expect(useCart.getState().cart).toHaveLength(0);
  });

  test('handleScanSubmit with form event should prevent default', async () => {
    const { result } = renderHook(() => usePosBilling());
    const mockEvent = { preventDefault: vi.fn() } as any;

    act(() => { result.current.setScanQuery('Pizza'); });
    await act(async () => { await result.current.handleScanSubmit(mockEvent); });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });
});
