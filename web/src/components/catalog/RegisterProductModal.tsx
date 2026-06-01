'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
  isFavorite: boolean;
}

interface RegisterProductModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  product: DBProduct | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    price: number;
    costPrice: number;
    stockCount: number;
    lowStockAlert: number;
    unitType: string;
    category: string;
    quickCode: string;
    barcode: string;
    icon: string;
  }) => Promise<void>;
}

const CATEGORIES = ['grocery', 'dairy', 'drinks', 'snacks', 'household'];
const UNIT_TYPES = ['Pieces', 'kg', 'Liters', 'Packets'];

export const RegisterProductModal: React.FC<RegisterProductModalProps> = ({
  isOpen,
  mode,
  product,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stockCount, setStockCount] = useState('');
  const [lowStockAlert, setLowStockAlert] = useState('5');
  const [unitType, setUnitType] = useState('Pieces');
  const [category, setCategory] = useState('grocery');
  const [quickCode, setQuickCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [icon, setIcon] = useState('📦');
  const [submitting, setSubmitting] = useState(false);

  // Sync form states with product or defaults when opened
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && product) {
        setName(product.name);
        setPrice(product.price.toString());
        setCostPrice(product.costPrice ? product.costPrice.toString() : '');
        setStockCount(product.stockCount.toString());
        setLowStockAlert(product.lowStockAlert ? product.lowStockAlert.toString() : '5');
        setUnitType(product.unitType || 'Pieces');
        setCategory(product.category || 'grocery');
        setQuickCode(product.quickCode || '');
        setBarcode(product.barcode || '');
        setIcon(product.icon || '📦');
      } else {
        setName('');
        setPrice('');
        setCostPrice('');
        setStockCount('');
        setLowStockAlert('5');
        setUnitType('Pieces');
        setCategory('grocery');
        setQuickCode('');
        setBarcode('');
        setIcon('📦');
      }
      setSubmitting(false);
    }
  }, [isOpen, mode, product]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !stockCount) {
      alert('Please fill in Name, Selling Price, and Stock Quantity.');
      return;
    }

    const priceNum = parseFloat(price);
    const costPriceNum = parseFloat(costPrice) || priceNum * 0.8;
    const stockCountNum = parseInt(stockCount) || 0;
    const lowStockAlertNum = parseInt(lowStockAlert) || 5;

    setSubmitting(true);
    try {
      await onSubmit({
        name,
        price: priceNum,
        costPrice: costPriceNum,
        stockCount: stockCountNum,
        lowStockAlert: lowStockAlertNum,
        unitType,
        category,
        quickCode,
        barcode,
        icon,
      });
      onClose();
    } catch (err) {
      console.error('Failed to submit product:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalContent, maxWidth: '580px' }}>
        <div style={styles.modalHeader}>
          <h3>{mode === 'create' ? 'Register New Product' : 'Edit Catalog Product'}</h3>
          <button onClick={onClose} style={styles.modalCloseBtn}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={styles.modalBody}>
          
          {/* Product Name */}
          <div style={styles.modalInputGroup}>
            <label style={styles.modalLabel}>Product Description Name *</label>
            <input 
              type="text" 
              placeholder="e.g. Anchor Milk Powder 400g" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.modalInput}
              required
            />
          </div>

          {/* Grid 2 Columns */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ ...styles.modalInputGroup, flex: 1 }}>
              <label style={styles.modalLabel}>Category</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                style={styles.select}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...styles.modalInputGroup, flex: 1 }}>
              <label style={styles.modalLabel}>Unit Type</label>
              <select 
                value={unitType} 
                onChange={(e) => setUnitType(e.target.value)} 
                style={styles.select}
              >
                {UNIT_TYPES.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid 2 Columns Price */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ ...styles.modalInputGroup, flex: 1 }}>
              <label style={styles.modalLabel}>Selling Price (Rs.) *</label>
              <input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={styles.modalInput}
                required
              />
            </div>

            <div style={{ ...styles.modalInputGroup, flex: 1 }}>
              <label style={styles.modalLabel}>Cost Price (Rs.)</label>
              <input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                style={styles.modalInput}
              />
            </div>
          </div>

          {/* Grid 2 Columns Stock */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ ...styles.modalInputGroup, flex: 1 }}>
              <label style={styles.modalLabel}>Stock Quantity *</label>
              <input 
                type="number" 
                placeholder="e.g. 50" 
                value={stockCount}
                onChange={(e) => setStockCount(e.target.value)}
                style={styles.modalInput}
                required
              />
            </div>

            <div style={{ ...styles.modalInputGroup, flex: 1 }}>
              <label style={styles.modalLabel}>Low Alert Level</label>
              <input 
                type="number" 
                placeholder="e.g. 5" 
                value={lowStockAlert}
                onChange={(e) => setLowStockAlert(e.target.value)}
                style={styles.modalInput}
              />
            </div>
          </div>

          {/* Identification details */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ ...styles.modalInputGroup, flex: 1 }}>
              <label style={styles.modalLabel}>Quick Code</label>
              <input 
                type="text" 
                placeholder="e.g. 101" 
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value)}
                style={styles.modalInput}
              />
            </div>

            <div style={{ ...styles.modalInputGroup, flex: 1 }}>
              <label style={styles.modalLabel}>Barcode</label>
              <input 
                type="text" 
                placeholder="e.g. 47900101" 
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                style={styles.modalInput}
              />
            </div>
          </div>

          {/* Emoji Icon picker */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ ...styles.modalInputGroup, flex: 1 }}>
              <label style={styles.modalLabel}>Product Icon Emoji</label>
              <input 
                type="text" 
                placeholder="e.g. 📦 / 🥛 / 🍎" 
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                style={styles.modalInput}
              />
            </div>
          </div>

          <button type="submit" disabled={submitting} style={styles.modalSubmitBtn}>
            {submitting ? 'Saving changes...' : mode === 'create' ? 'Save Product' : 'Update Product details'}
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
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
  },
  modalSubmitBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '8px',
  },
};
