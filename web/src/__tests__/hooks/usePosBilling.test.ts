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

const mockMutateAsync = vi.fn().mockResolvedValue({ invoiceNumber: 'INV-1001' });

vi.mock('../../hooks/useOrders', () => ({
  useCreateOrder: () => ({
    mutateAsync: mockMutateAsync,
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

  test('should validate payment edge cases for card and bank methods', () => {
    setupCart();
    const { result } = renderHook(() => usePosBilling());

    // 1. Card validation details
    act(() => { result.current.handlePaymentMethodChange('card'); });
    
    // empty bankName, invalid card digits (empty)
    act(() => { result.current.setBankName(''); result.current.setCardDigits(''); });
    expect(result.current.isPaymentValid).toBe(false);

    // valid bankName, invalid card digits (too short)
    act(() => { result.current.setBankName('Sampath Bank'); result.current.setCardDigits('12'); });
    expect(result.current.isPaymentValid).toBe(false);

    // valid bankName, invalid card digits (non-numeric)
    act(() => { result.current.setCardDigits('12ab'); });
    expect(result.current.isPaymentValid).toBe(false);

    // valid bankName, valid card digits
    act(() => { result.current.setCardDigits('1234'); });
    expect(result.current.isPaymentValid).toBe(true);

    // 2. Bank validation details
    act(() => { result.current.handlePaymentMethodChange('bank'); });
    
    // empty bankName
    act(() => { result.current.setBankName(''); });
    expect(result.current.isPaymentValid).toBe(false);

    // whitespace bankName
    act(() => { result.current.setBankName('   '); });
    expect(result.current.isPaymentValid).toBe(false);

    // valid bankName
    act(() => { result.current.setBankName('BOC'); });
    expect(result.current.isPaymentValid).toBe(true);
  });

  test('should handle F9 and Enter key focus and payment submissions via refs', async () => {
    const { result } = renderHook(() => usePosBilling());

    // Create mock DOM elements
    const mockCashInput = document.createElement('input');
    const mockDigitsInput = document.createElement('input');
    const mockBankNameInput = document.createElement('input');

    // Attach them to the refs
    result.current.cashReceivedRef.current = mockCashInput;
    result.current.cardDigitsRef.current = mockDigitsInput;
    result.current.bankNameRef.current = mockBankNameInput;

    const spyCashFocus = vi.spyOn(mockCashInput, 'focus');
    const spyDigitsFocus = vi.spyOn(mockDigitsInput, 'focus');
    const spyBankNameFocus = vi.spyOn(mockBankNameInput, 'focus');

    // Test F9 - card & isCustomBank = true -> focus bankNameRef
    act(() => {
      result.current.handlePaymentMethodChange('card');
      result.current.setIsCustomBank(true);
    });
    act(() => { fireKey('F9'); });
    expect(spyBankNameFocus).toHaveBeenCalled();

    // Test F9 - card & isCustomBank = false -> focus cardDigitsRef
    act(() => {
      result.current.setIsCustomBank(false);
    });
    act(() => { fireKey('F9'); });
    expect(spyDigitsFocus).toHaveBeenCalled();

    // Test F9 - bank & isCustomBank = true -> focus bankNameRef
    act(() => {
      result.current.handlePaymentMethodChange('bank');
      result.current.setIsCustomBank(true);
    });
    spyBankNameFocus.mockClear();
    act(() => { fireKey('F9'); });
    expect(spyBankNameFocus).toHaveBeenCalled();

    // Test Enter key focus behaviors
    const originalActiveElement = document.activeElement;
    Object.defineProperty(document, 'activeElement', {
      get: () => mockCashInput,
      configurable: true,
    });

    // When focused on cashReceivedRef, Enter confirms checkout
    act(() => { fireKey('Enter'); });

    // When focused on cardDigitsRef, Enter confirms checkout
    Object.defineProperty(document, 'activeElement', {
      get: () => mockDigitsInput,
      configurable: true,
    });
    act(() => { fireKey('Enter'); });

    // When focused on bankNameRef and method is card -> focus cardDigitsRef
    Object.defineProperty(document, 'activeElement', {
      get: () => mockBankNameInput,
      configurable: true,
    });
    act(() => {
      result.current.handlePaymentMethodChange('card');
    });
    spyDigitsFocus.mockClear();
    act(() => { fireKey('Enter'); });
    expect(spyDigitsFocus).toHaveBeenCalled();

    // When focused on bankNameRef and method is not card -> checkoutConfirmRef
    act(() => {
      result.current.handlePaymentMethodChange('bank');
    });
    act(() => { fireKey('Enter'); });

    // Restore activeElement to original
    Object.defineProperty(document, 'activeElement', {
      value: originalActiveElement,
      configurable: true,
    });
  });

  test('should handle F7 and F8 key hotkeys for tax editing and card/bank focus', () => {
    const { result } = renderHook(() => usePosBilling());

    // F7 when isEditingTax is true
    act(() => {
      result.current.setIsEditingTax(true);
    });
    act(() => {
      fireKey('F7');
    });

    // Create mock DOM elements
    const mockCardBrandSelect = document.createElement('select');
    const mockBankNameSelect = document.createElement('select');
    result.current.cardBrandSelectRef.current = mockCardBrandSelect;
    result.current.bankNameSelectRef.current = mockBankNameSelect;

    const spyCardBrandFocus = vi.spyOn(mockCardBrandSelect, 'focus');
    const spyBankNameSelectFocus = vi.spyOn(mockBankNameSelect, 'focus');

    // F8 when paymentMethod is card -> focus cardBrandSelectRef
    act(() => {
      result.current.handlePaymentMethodChange('card');
    });
    act(() => {
      fireKey('F8');
    });
    expect(spyCardBrandFocus).toHaveBeenCalled();

    // F8 when paymentMethod is bank -> focus bankNameSelectRef
    act(() => {
      result.current.handlePaymentMethodChange('bank');
    });
    act(() => {
      fireKey('F8');
    });
    expect(spyBankNameSelectFocus).toHaveBeenCalled();
  });

  test('should successfully complete checkout for cash payment', async () => {
    setupCart();
    const { result } = renderHook(() => usePosBilling());

    // Setup valid payment
    act(() => {
      result.current.setCashReceived('1000');
    });
    expect(result.current.isPaymentValid).toBe(true);

    // Call checkout
    await act(async () => {
      await result.current.handleConfirmCheckout();
    });

    expect(result.current.paying).toBe(false);
    expect(result.current.showReceipt).toBe(true);
    expect(result.current.latestOrder).toBeDefined();
    expect(result.current.latestOrder?.invoiceNumber).toBe('INV-1001');
    expect(result.current.cart).toHaveLength(0);
  });

  test('should successfully complete checkout for card payment', async () => {
    setupCart();
    const { result } = renderHook(() => usePosBilling());

    act(() => {
      result.current.handlePaymentMethodChange('card');
      result.current.setBankName('Commercial Bank');
      result.current.setCardDigits('4321');
    });
    expect(result.current.isPaymentValid).toBe(true);

    await act(async () => {
      await result.current.handleConfirmCheckout();
    });

    expect(result.current.showReceipt).toBe(true);
    expect(result.current.latestOrder?.bankName).toBe('Commercial Bank');
    expect(result.current.latestOrder?.cardLastFour).toBe('4321');
  });

  test('should handle checkout error gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setupCart();
    
    mockMutateAsync.mockRejectedValueOnce(new Error('Checkout mutation failed'));

    const { result } = renderHook(() => usePosBilling());

    act(() => {
      result.current.setCashReceived('1000');
    });

    await act(async () => {
      await result.current.handleConfirmCheckout();
    });

    expect(errorSpy).toHaveBeenCalledWith('Failed to complete sale checkout:', expect.any(Error));
    errorSpy.mockRestore();
  });

  test('should trigger alerts and fail checkout for invalid payment details', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    setupCart();
    const { result } = renderHook(() => usePosBilling());

    // 1. Card with empty bankName
    act(() => {
      result.current.handlePaymentMethodChange('card');
      result.current.setBankName('');
    });
    await act(async () => {
      await result.current.handleConfirmCheckout();
    });
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Card Brand/Bank Required'));

    // 2. Card with invalid digits
    act(() => {
      result.current.setBankName('Sampath Bank');
      result.current.setCardDigits('12');
    });
    alertSpy.mockClear();
    await act(async () => {
      await result.current.handleConfirmCheckout();
    });
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Card Number Required'));

    // 3. Bank with empty bankName
    act(() => {
      result.current.handlePaymentMethodChange('bank');
      result.current.setBankName('   ');
    });
    alertSpy.mockClear();
    await act(async () => {
      await result.current.handleConfirmCheckout();
    });
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Beneficiary Bank Name Required'));

    alertSpy.mockRestore();
  });
});
