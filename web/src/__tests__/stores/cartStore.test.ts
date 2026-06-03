import { describe, test, expect, beforeEach } from 'vitest';
import { useCart } from '../../stores/cartStore';

describe('cartStore', () => {
  beforeEach(() => {
    useCart.getState().clearCart();
    useCart.setState({ customCustomers: [] });
  });

  test('should initialize with empty cart and customer', () => {
    const state = useCart.getState();
    expect(state.cart).toEqual([]);
    expect(state.customer).toBeNull();
    expect(state.customCustomers).toEqual([]);
  });

  test('should add a new product item to the cart', () => {
    useCart.getState().addCartItem('Bread', 120, '🍞', 'BREAD01', 10);

    const state = useCart.getState();
    expect(state.cart).toHaveLength(1);
    expect(state.cart[0].name).toBe('Bread');
    expect(state.cart[0].price).toBe(120);
    expect(state.cart[0].quantity).toBe(1);
    expect(state.cart[0].icon).toBe('🍞');
    expect(state.cart[0].sku).toBe('BREAD01');
    expect(state.cart[0].stock).toBe(10);
  });

  test('should increment quantity when adding existing item', () => {
    useCart.getState().addCartItem('Apple', 60);
    useCart.getState().addCartItem('Apple', 60);

    const state = useCart.getState();
    expect(state.cart).toHaveLength(1);
    expect(state.cart[0].quantity).toBe(2);
  });

  test('should update item quantities correctly', () => {
    useCart.getState().addCartItem('Orange', 70);
    const item = useCart.getState().cart[0];

    // Increment
    useCart.getState().updateQuantity(item.id, 2);
    expect(useCart.getState().cart[0].quantity).toBe(3);

    // Decrement
    useCart.getState().updateQuantity(item.id, -1);
    expect(useCart.getState().cart[0].quantity).toBe(2);
  });

  test('should remove item from cart if quantity becomes 0 or negative', () => {
    useCart.getState().addCartItem('Milk', 240);
    const item = useCart.getState().cart[0];

    useCart.getState().updateQuantity(item.id, -1);
    expect(useCart.getState().cart).toEqual([]);
  });

  test('should attach and remove customer correctly', () => {
    const cust = { name: 'Saman Perera', phone: '0711112222' };
    useCart.getState().setCustomer(cust);
    expect(useCart.getState().customer).toEqual(cust);

    useCart.getState().setCustomer(null);
    expect(useCart.getState().customer).toBeNull();
  });

  test('should register custom customer without duplicates', () => {
    const cust = { name: 'Kamal Silva', phone: '0723334444' };
    useCart.getState().addCustomCustomer(cust);
    expect(useCart.getState().customCustomers).toHaveLength(1);

    // Try adding duplicate
    useCart.getState().addCustomCustomer(cust);
    expect(useCart.getState().customCustomers).toHaveLength(1);

    // Add different customer
    useCart.getState().addCustomCustomer({ name: 'Kamal Silva', phone: '0729998888' });
    expect(useCart.getState().customCustomers).toHaveLength(2);
  });
});
