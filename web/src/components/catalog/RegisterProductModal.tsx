'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, Trash2, Image, Loader2, Scan } from 'lucide-react';
import { deleteUploadThingFile } from '../../services/uploadQueue';
import { useBusinessStore } from '../../stores/businessStore';
import {
  getBusinessTypeConfig,
  getCategoryEmoji,
  getCategoryLabel,
} from '../../utils/businessTypeConfig';
import { Scanner } from '../Scanner';

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

export const RegisterProductModal: React.FC<RegisterProductModalProps> = ({
  isOpen,
  mode,
  product,
  onClose,
  onSubmit,
}) => {
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const config = getBusinessTypeConfig(activeBusiness?.category);
  const CATEGORIES = config.categories;
  const UNIT_TYPES = config.unitTypes;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stockCount, setStockCount] = useState('');
  const [lowStockAlert, setLowStockAlert] = useState('5');
  const [unitType, setUnitType] = useState(config.defaultUnitType);
  const [category, setCategory] = useState(config.defaultCategory);
  const [quickCode, setQuickCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [icon, setIcon] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync form states with product or defaults when opened
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && product) {
        setName(product.name);
        setPrice(product.price.toString());
        setCostPrice(product.costPrice ? product.costPrice.toString() : '');
        setStockCount(product.stockCount.toString());
        setLowStockAlert(product.lowStockAlert ? product.lowStockAlert.toString() : '5');
        setUnitType(product.unitType || config.defaultUnitType);
        setCategory(product.category || config.defaultCategory);
        setQuickCode(product.quickCode || '');
        setBarcode(product.barcode || '');
        setIcon(product.icon || '');
      } else {
        setName('');
        setPrice('');
        setCostPrice('');
        setStockCount('');
        setLowStockAlert('5');
        setUnitType(config.defaultUnitType);
        setCategory(config.defaultCategory);
        setQuickCode('');
        setBarcode('');
        setIcon('');
      }
      setSubmitting(false);
      setUploadingImage(false);
    }
  }, [isOpen, mode, product, config.defaultCategory, config.defaultUnitType]);

  if (!isOpen) return null;

  const readAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file size validation (Max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      alert('Image size exceeds the 4MB limit. Please choose a smaller image.');
      return;
    }

    // Convert to Base64 data URL for instant offline preview & local DB saving
    try {
      const base64 = await readAsBase64(file);
      setIcon(base64);
    } catch (err) {
      console.error('Failed to convert image to base64:', err);
      alert('Failed to process image file.');
    }
  };

  const handleRemoveImage = async () => {
    if (icon.startsWith('http')) {
      await deleteUploadThingFile(icon);
    }
    setIcon('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !stockCount) {
      alert('Please enter product name, selling price, and stock quantity.');
      return;
    }

    if (!quickCode && !barcode) {
      alert('Please enter at least either a Quick Code or a Barcode.');
      return;
    }

    const priceNum = parseFloat(price);
    const costPriceNum = parseFloat(costPrice) || priceNum * 0.8;
    const stockCountNum = parseInt(stockCount) || 0;
    const lowStockAlertNum = parseInt(lowStockAlert) || 5;

    setSubmitting(true);
    try {
      // Use icon url/base64 if available, otherwise get category default emoji
      const finalIcon = icon || getCategoryEmoji(category, activeBusiness?.category);

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
        icon: finalIcon,
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
          <div>
            <h3 style={styles.modalTitle}>
              {mode === 'create' ? 'Register New Product' : 'Edit Catalog Product'}
            </h3>
            <p style={styles.modalSubtitle}>
              Manage item metadata, pricing, inventory alerts, and image representation.
            </p>
          </div>
          <button onClick={onClose} style={styles.modalCloseBtn}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={styles.modalForm}>
          <div style={styles.modalBody}>
            {/* Top Section: Name, Barcode, Quick Code on left; Image on right */}
            <div style={styles.topSection}>
              {/* Left Column (Inputs) */}
              <div style={styles.topLeftCol}>
                {/* Row 1: Product Name */}
                <div style={styles.modalInputGroup}>
                  <label style={styles.modalLabel}>Product Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Anchor Milk Powder 400g"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={styles.modalInput}
                    required
                  />
                </div>

                {/* Row 2: Barcode & Quick Code */}
                <div style={styles.topSubGrid}>
                  <div style={styles.modalInputGroup}>
                    <label style={styles.modalLabel}>Barcode</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="e.g. 47900101"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        style={{ ...styles.modalInput, paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        style={styles.barcodeScanBtn}
                        title="Scan Barcode using camera"
                      >
                        <Scan size={18} color="var(--primary)" />
                      </button>
                    </div>
                  </div>

                  <div style={styles.modalInputGroup}>
                    <label style={styles.modalLabel}>Quick Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 2016"
                      value={quickCode}
                      onChange={(e) => setQuickCode(e.target.value)}
                      style={styles.modalInput}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column (Image) */}
              <div style={styles.topRightCol}>
                <label style={styles.modalLabel}>Product Image</label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />

                {icon ? (
                  <div style={styles.compactImagePreviewContainer}>
                    {icon.startsWith('http') ||
                    icon.startsWith('data:') ||
                    icon.startsWith('blob:') ? (
                      <img src={icon} alt="Preview" style={styles.compactImagePreview} />
                    ) : (
                      <div style={styles.compactEmojiFallbackPreview}>{icon}</div>
                    )}

                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      style={styles.compactRemoveBtn}
                      title="Remove Image"
                    >
                      <X size={10} />
                    </button>

                    {uploadingImage && (
                      <div style={styles.compactUploadingOverlay}>
                        <Loader2 size={14} className="spin-anim" style={{ color: '#ffffff' }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => !uploadingImage && fileInputRef.current?.click()}
                    style={styles.compactUploadPlaceholder}
                    title="Upload Product Image"
                  >
                    <UploadCloud size={20} color="var(--primary)" />
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--muted)',
                        fontWeight: '600',
                        marginTop: '4px',
                      }}
                    >
                      Upload Image
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '2px' }}>
                      (Max 4MB)
                    </span>

                    {uploadingImage && (
                      <div style={styles.compactUploadingOverlay}>
                        <Loader2 size={14} className="spin-anim" style={{ color: '#ffffff' }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.divider} />

            {/* Grid 2 Columns - Category & Unit Type dropdowns */}
            <div style={styles.gridTwo}>
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={styles.select}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {getCategoryLabel(cat, activeBusiness?.category)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Unit Type</label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  style={styles.select}
                >
                  {UNIT_TYPES.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid 2 Columns Price */}
            <div style={styles.gridTwo}>
              <div style={styles.modalInputGroup}>
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

              <div style={styles.modalInputGroup}>
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
            <div style={styles.gridTwo}>
              <div style={styles.modalInputGroup}>
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

              <div style={styles.modalInputGroup}>
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
          </div>

          <div style={styles.modalFooter}>
            <button
              type="submit"
              disabled={submitting || uploadingImage}
              style={styles.modalSubmitBtn}
            >
              {submitting
                ? 'Saving changes...'
                : mode === 'create'
                  ? 'Save Product to Catalog'
                  : 'Update Catalog details'}
            </button>
          </div>
        </form>
      </div>
      {showScanner && (
        <Scanner
          onScan={(code) => {
            setBarcode(code);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
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
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(4px)',
    padding: '16px',
    overflowY: 'auto',
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
  },
  modalHeader: {
    padding: '18px 24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--dark)',
    margin: 0,
  },
  modalSubtitle: {
    fontSize: '11px',
    color: 'var(--muted)',
    marginTop: '4px',
    marginRight: '20px',
    lineHeight: '1.4',
  },
  modalCloseBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  modalBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
    flex: 1,
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    flexShrink: 0,
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
    whiteSpace: 'nowrap',
  },
  modalInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#ffffff',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  select: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  gridTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border)',
    margin: '8px 0 16px 0',
    width: '100%',
  },
  modalSubmitBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  topSection: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start',
  },
  topLeftCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  topRightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flexShrink: 0,
  },
  topSubGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  compactUploadPlaceholder: {
    width: '120px',
    height: '120px',
    borderRadius: '8px',
    border: '1.5px dashed var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    backgroundColor: '#fafafa',
    transition: 'all 0.2s ease',
    position: 'relative',
  },
  compactImagePreviewContainer: {
    width: '120px',
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    position: 'relative',
    backgroundColor: '#fafafa',
  },
  compactImagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: '8px',
    objectFit: 'cover',
  },
  compactEmojiFallbackPreview: {
    fontSize: '20px',
  },
  compactRemoveBtn: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: 'var(--error)',
    color: '#ffffff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  },
  compactUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeScanBtn: {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
};
