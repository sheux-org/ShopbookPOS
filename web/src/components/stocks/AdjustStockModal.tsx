'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { ProductImage } from '../ProductImage';

interface DBProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  stockCount: number;
  lowStockAlert?: number;
  unitType?: string;
  costPrice?: number;
  quickCode?: string;
  barcode?: string;
}

interface AdjustStockModalProps {
  isOpen: boolean;
  product: DBProduct | null;
  onClose: () => void;
  onSubmit: (type: 'in' | 'out', qty: number, reason: string) => Promise<void>;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  isOpen,
  product,
  onClose,
  onSubmit,
}) => {
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in');
  const [adjustQty, setAdjustQty] = useState('10');
  const [adjustReason, setAdjustReason] = useState('Restock Inventory');
  const [adjusting, setAdjusting] = useState(false);

  // Reset local states when modal opens/changes product
  useEffect(() => {
    if (isOpen && product) {
      setAdjustType('in');
      setAdjustQty('10');
      setAdjustReason('Restock Inventory');
      setAdjusting(false);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseFloat(adjustQty);
    if (isNaN(qtyNum) || qtyNum <= 0) return;

    setAdjusting(true);
    try {
      await onSubmit(adjustType, qtyNum, adjustReason);
      onClose();
    } catch (err) {
      console.error('Failed to submit adjustment:', err);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3>Inventory Audit Adjustment</h3>
          <button onClick={onClose} style={styles.modalCloseBtn}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={styles.modalBody}>
          <div style={styles.modalProductHeader}>
            <ProductImage
              icon={product.icon}
              size={48}
              style={{ border: 'none', borderRadius: '8px' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>{product.name}</h4>
              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--muted)',
                  marginTop: '2px',
                  marginBlockEnd: 0,
                }}
              >
                Current Count: {product.stockCount} {product.unitType || 'Units'}
              </p>
            </div>
          </div>

          {/* Adjust type */}
          <div style={styles.modalInputGroup}>
            <label style={styles.modalLabel}>Adjustment Type</label>
            <div style={styles.adjustTypeToggle}>
              <button
                type="button"
                onClick={() => {
                  setAdjustType('in');
                  setAdjustReason('Restock Inventory');
                }}
                style={{
                  ...styles.toggleBtn,
                  ...(adjustType === 'in' ? styles.toggleBtnInActive : {}),
                }}
              >
                <span>Receive / Add Stock</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustType('out');
                  setAdjustReason('Damaged Items');
                }}
                style={{
                  ...styles.toggleBtn,
                  ...(adjustType === 'out' ? styles.toggleBtnOutActive : {}),
                }}
              >
                <span>Deduct / Write Out</span>
              </button>
            </div>
          </div>

          {/* Qty */}
          <div style={styles.modalInputGroup}>
            <label style={styles.modalLabel}>Change Quantity</label>
            <input
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              required
              min="0.01"
              step="any"
              style={styles.modalInput}
            />
          </div>

          {/* Reason */}
          <div style={styles.modalInputGroup}>
            <label style={styles.modalLabel}>Adjustment Reason</label>
            <select
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              style={styles.select}
            >
              {adjustType === 'in' ? (
                <>
                  <option value="Restock Inventory">Restock Inventory</option>
                  <option value="Returned Items">Returned Items</option>
                  <option value="Stock Audit Adjust">Stock Audit Adjust</option>
                </>
              ) : (
                <>
                  <option value="Damaged Items">Damaged Items</option>
                  <option value="Theft or Loss">Theft or Loss</option>
                  <option value="Stock Audit Adjust">Stock Audit Adjust</option>
                  <option value="Expired Items">Expired Items</option>
                </>
              )}
            </select>
          </div>

          <button type="submit" disabled={adjusting || !adjustQty} style={styles.modalSubmitBtn}>
            <Save size={16} />
            <span>{adjusting ? 'Saving adjustments...' : 'Save Audit Adjust'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(3px)',
  },
  modalContent: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
  },
  modalBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalProductHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'var(--light-blue)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--accent-blue)',
  },
  modalInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  modalLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--dark)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
  },
  adjustTypeToggle: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  toggleBtn: {
    padding: '10px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--muted)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  toggleBtnInActive: {
    border: '1px solid var(--success)',
    backgroundColor: '#effaf3',
    color: 'var(--success)',
  },
  toggleBtnOutActive: {
    border: '1px solid var(--error)',
    backgroundColor: '#fff1f2',
    color: 'var(--error)',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
    cursor: 'pointer',
  },
  modalSubmitBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
};
