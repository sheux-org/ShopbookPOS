'use client';

import React from 'react';
import { MinusCircle, PlusCircle, Trash2, ShoppingBag } from 'lucide-react';
import { ProductImage } from '../ProductImage';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  icon?: string;
  sku?: string;
  maxStock?: number;
}

interface TabletCartScrollerProps {
  cart: CartItem[];
  updateQuantity: (itemId: string, diff: number) => void;
}

export const TabletCartScroller: React.FC<TabletCartScrollerProps> = ({ cart, updateQuantity }) => {
  return (
    <div style={styles.tabletCartScroller}>
      {cart.map((item) => (
        <div key={item.id} style={styles.cartItemRow}>
          <ProductImage
            icon={item.icon}
            size={42}
            style={{ border: 'none', borderRadius: '6px' }}
          />
          <div style={{ flex: 1, minWidth: 0, marginLeft: '8px' }}>
            <h4 style={styles.cartItemName}>{item.name}</h4>
            <span style={styles.cartItemPrice}>Rs. {item.price.toLocaleString()}</span>
          </div>

          {/* Quantity adjust buttons */}
          <div style={styles.qtyContainer}>
            <button onClick={() => updateQuantity(item.id, -1)} style={styles.qtyBtn}>
              <MinusCircle size={16} color="var(--muted)" />
            </button>
            <span style={styles.qtyText}>{item.quantity}</span>
            <button onClick={() => updateQuantity(item.id, 1)} style={styles.qtyBtn}>
              <PlusCircle size={16} color="var(--primary)" />
            </button>
          </div>

          <span style={styles.cartItemSum}>
            Rs. {(item.price * item.quantity).toLocaleString()}
          </span>

          <button
            onClick={() => updateQuantity(item.id, -item.quantity)}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--error)',
              cursor: 'pointer',
              marginLeft: '6px',
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {cart.length === 0 && (
        <div style={styles.emptyCartState}>
          <ShoppingBag size={64} color="#cbd5e1" style={{ marginBottom: '12px' }} />
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#475569' }}>
            No items in cart
          </span>
          <span
            style={{
              fontSize: '11px',
              color: '#64748b',
              marginTop: '6px',
              textAlign: 'center',
              maxWidth: '280px',
              lineHeight: '1.4',
            }}
          >
            Scan product barcode or type a quick-code to begin checkout.
          </span>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  tabletCartScroller: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    flex: 1,
    minHeight: '150px',
    maxHeight: '260px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '12px',
    marginBottom: '12px',
  },
  cartItemRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px',
    backgroundColor: 'var(--background)',
    borderRadius: '6px',
    border: '1px solid var(--border)',
  },
  cartItemName: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cartItemPrice: {
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '2px',
  },
  qtyContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    margin: '0 8px',
  },
  qtyBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '2px',
  },
  qtyText: {
    fontSize: '11px',
    fontWeight: 'bold',
    minWidth: '16px',
    textAlign: 'center',
  },
  cartItemSum: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--primary)',
    minWidth: '60px',
    textAlign: 'right',
  },
  emptyCartState: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '160px',
  },
};
