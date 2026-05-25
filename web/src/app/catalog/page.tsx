'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import database from '../../db/database';
import { Q } from '@nozbe/watermelondb';
import { 
  Search, Plus, Trash2, Edit2, Star, CheckCircle, X, Package, 
  ArrowLeft, ArrowUpDown, ChevronLeft, ChevronRight, Sparkles 
} from 'lucide-react';

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

const CATEGORIES = ['grocery', 'dairy', 'drinks', 'snacks', 'household'];
const UNIT_TYPES = ['Pieces', 'kg', 'Liters', 'Packets'];

export default function CatalogManagerPage() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);

  // States
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // CRUD Modals
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form States
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

  // Trigger Toast notifications
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  // Load products from IndexedDB
  const loadProducts = async () => {
    if (typeof window === 'undefined') return;
    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      let list: any[] = [];
      if (activeBiz && activeBiz.id !== '0') {
        const matchedBiz = await database.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
        if (matchedBiz.length > 0) {
          list = await database.get('products').query(Q.where('business_id', matchedBiz[0].id)).fetch();
        }
      } else {
        list = await database.get('products').query().fetch();
      }

      setProducts(list.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category || '',
        icon: p.icon || '📦',
        stockCount: p.stockCount || 0,
        lowStockAlert: p.lowStockAlert,
        unitType: p.unitType,
        costPrice: p.costPrice,
        quickCode: p.quickCode,
        barcode: p.barcode,
        isFavorite: p.isFavorite || false
      })));
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadProducts();
    }
  }, [isLoggedIn, activeBusiness]);

  useEffect(() => {
    const handleOpenModal = () => {
      openAddModal();
    };
    window.addEventListener('open-register-product-modal', handleOpenModal);
    return () => {
      window.removeEventListener('open-register-product-modal', handleOpenModal);
    };
  }, []);

  // Handle Favorites toggle
  const toggleFavorite = async (productId: string, currentFav: boolean) => {
    try {
      const record = await database.get('products').find(productId);
      await database.write(async () => {
        await record.update((p: any) => {
          p.isFavorite = !currentFav;
        });
      });
      triggerToast(currentFav ? 'Removed from favorites' : 'Marked as favorite ⭐');
      loadProducts();
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${productName}" from the catalog?`)) return;
    try {
      const record = await database.get('products').find(productId);
      await database.write(async () => {
        await record.destroyPermanently();
      });
      triggerToast('Product deleted 🗑️');
      loadProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  // Open Edit Modal
  const openEditModal = (p: DBProduct) => {
    setModalMode('edit');
    setEditingProductId(p.id);
    setName(p.name);
    setPrice(p.price.toString());
    setCostPrice(p.costPrice ? p.costPrice.toString() : '');
    setStockCount(p.stockCount.toString());
    setLowStockAlert(p.lowStockAlert ? p.lowStockAlert.toString() : '5');
    setUnitType(p.unitType || 'Pieces');
    setCategory(p.category || 'grocery');
    setQuickCode(p.quickCode || '');
    setBarcode(p.barcode || '');
    setIcon(p.icon || '📦');
    setShowModal(true);
  };

  // Open Add Modal
  const openAddModal = () => {
    setModalMode('create');
    setEditingProductId(null);
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
    setShowModal(true);
  };

  // Submit Modal form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !stockCount) {
      alert('Please fill in Name, Selling Price, and Stock Quantity.');
      return;
    }

    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      
      await database.write(async () => {
        // Fetch active business record
        const bizs = await database.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
        const dbBiz = bizs[0];

        if (modalMode === 'create') {
          // Create product record
          const newProd = await database.get('products').create((p: any) => {
            p.business.set(dbBiz);
            p.name = name;
            p.price = parseFloat(price);
            p.category = category.toLowerCase();
            p.icon = icon;
            p.stockCount = parseInt(stockCount) || 0;
            p.unitType = unitType;
            p.costPrice = parseFloat(costPrice) || parseFloat(price) * 0.8;
            if (quickCode) p.quickCode = quickCode;
            if (barcode) p.barcode = barcode;
            p.lowStockAlert = parseInt(lowStockAlert) || 5;
            p.isFavorite = false;
          });

          // Log stock input
          if (parseInt(stockCount) > 0) {
            await database.get('inventory_logs').create((log: any) => {
              log.product.set(newProd);
              log.type = 'in';
              log.quantity = parseInt(stockCount);
              log.reason = 'Initial Seed';
            });
          }
          triggerToast('New item added! 📦');
        } else if (modalMode === 'edit' && editingProductId) {
          const record: any = await database.get('products').find(editingProductId);
          const oldStock = record.stockCount;
          const newStock = parseInt(stockCount) || 0;

          await record.update((p: any) => {
            p.name = name;
            p.price = parseFloat(price);
            p.category = category.toLowerCase();
            p.icon = icon;
            p.stockCount = newStock;
            p.unitType = unitType;
            p.costPrice = parseFloat(costPrice) || parseFloat(price) * 0.8;
            p.quickCode = quickCode || null;
            p.barcode = barcode || null;
            p.lowStockAlert = parseInt(lowStockAlert) || 5;
          });

          // Inventory log adjustments
          if (newStock !== oldStock) {
            await database.get('inventory_logs').create((log: any) => {
              log.product.set(record);
              log.type = newStock > oldStock ? 'in' : 'out';
              log.quantity = Math.abs(newStock - oldStock);
              log.reason = 'Manual Adjustment';
            });
          }
          triggerToast('Item updated successfully!');
        }
      });

      setShowModal(false);
      loadProducts();
    } catch (err) {
      console.error('Failed to save product details:', err);
    }
  };

  // Search filter
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchQuery = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.quickCode && p.quickCode.includes(searchQuery)) ||
        (p.barcode && p.barcode.includes(searchQuery));
      const matchCat = selectedCategoryFilter === 'All' || p.category.toLowerCase() === selectedCategoryFilter.toLowerCase();
      return matchQuery && matchCat;
    });
  }, [products, searchQuery, selectedCategoryFilter]);

  return (
    <div style={styles.workspace} className="fade-in">
      {/* Toast notifications */}
      {toastMsg && (
        <div style={styles.toast}>
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}



      {/* Search and Category filters row */}
      <div style={styles.filterRow}>
        <div style={styles.searchBox}>
          <Search size={18} color="var(--muted)" />
          <input
            type="text"
            placeholder="Search items by name, barcode, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.categoryTabs}>
          {['All', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              style={{
                ...styles.filterTab,
                ...(selectedCategoryFilter.toLowerCase() === cat.toLowerCase() ? styles.filterTabActive : {}),
              }}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog items Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={{ ...styles.th, width: '40px' }}>Fav</th>
                <th style={styles.th}>Item Name</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Quick Code</th>
                <th style={styles.th}>Barcode</th>
                <th style={styles.th}>Retail Price</th>
                <th style={styles.th}>Cost Price</th>
                <th style={styles.th}>Stock Status</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const isOut = p.stockCount <= 0;
                const isLow = p.lowStockAlert && p.stockCount <= p.lowStockAlert;
                return (
                  <tr key={p.id} style={styles.trRow}>
                    <td style={styles.td}>
                      <button 
                        onClick={() => toggleFavorite(p.id, p.isFavorite)}
                        style={styles.favBtn}
                      >
                        <Star size={18} fill={p.isFavorite ? 'var(--yellow)' : 'transparent'} color={p.isFavorite ? 'var(--yellow)' : 'var(--muted)'} />
                      </button>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={styles.itemEmoji}>{p.icon}</span>
                        <div>
                          <div style={styles.itemName}>{p.name}</div>
                          <span style={styles.itemUnitType}>{p.unitType || 'Pieces'}</span>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.catBadge,
                        backgroundColor: p.category === 'household' ? '#f3e8ff' : p.category === 'snacks' ? '#fef3c7' : '#eff6ff',
                        color: p.category === 'household' ? '#7e22ce' : p.category === 'snacks' ? '#b45309' : 'var(--primary)',
                      }}>
                        {p.category.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {p.quickCode ? <code style={styles.code}>#{p.quickCode}</code> : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {p.barcode ? <span style={{ fontFamily: 'monospace' }}>{p.barcode}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      <strong>Rs. {p.price.toLocaleString()}</strong>
                    </td>
                    <td style={styles.td}>
                      Rs. {p.costPrice ? p.costPrice.toLocaleString() : (p.price * 0.8).toLocaleString()}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.stockStatusBadge,
                        backgroundColor: isOut ? '#fee2e2' : isLow ? '#ffedd5' : '#dcfce7',
                        color: isOut ? '#dc2626' : isLow ? '#d97706' : '#15803d',
                      }}>
                        {isOut ? 'Out of stock' : isLow ? `Low Alert (${p.stockCount})` : `${p.stockCount} in stock`}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => openEditModal(p)} style={styles.editBtn} title="Edit product details">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDeleteProduct(p.id, p.name)} style={styles.deleteBtn} title="Delete product">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} style={styles.emptyRow}>
                    <Package size={36} color="var(--muted)" style={{ marginBottom: '8px' }} />
                    <h4>No catalog items found</h4>
                    <p>Try searching another keyword or register a new product.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRUD Product Modal Dialog */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '580px' }}>
            <div style={styles.modalHeader}>
              <h3>{modalMode === 'create' ? 'Register New Product' : 'Edit Catalog Product'}</h3>
              <button onClick={() => setShowModal(false)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            <form onSubmit={handleFormSubmit} style={styles.modalBody}>
              
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

              <button type="submit" style={styles.modalSubmitBtn}>
                {modalMode === 'create' ? 'Save Product' : 'Update Product details'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  workspace: {
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    height: '100%',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: '800',
    color: 'var(--dark)',
    lineHeight: '1.2',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--muted)',
    marginTop: '4px',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)',
  },
  filterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: '280px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    boxShadow: 'var(--shadow)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: 'var(--dark)',
  },
  categoryTabs: {
    display: 'flex',
    gap: '6px',
    overflowX: 'auto',
  },
  filterTab: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  filterTabActive: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    borderColor: 'var(--primary)',
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
  },
  trHead: {
    borderBottom: '1px solid var(--border)',
    backgroundColor: '#f9fafb',
  },
  th: {
    padding: '16px 20px',
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  trRow: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'background 0.2s',
  },
  td: {
    padding: '16px 20px',
    verticalAlign: 'middle',
  },
  favBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: '4px',
  },
  itemEmoji: {
    fontSize: '26px',
  },
  itemName: {
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  itemUnitType: {
    fontSize: '11px',
    color: 'var(--muted)',
  },
  catBadge: {
    fontSize: '10px',
    fontWeight: '800',
    padding: '3px 8px',
    borderRadius: '4px',
    letterSpacing: '0.3px',
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: '#f1f5f9',
    padding: '2px 6px',
    borderRadius: '4px',
    color: '#475569',
  },
  stockStatusBadge: {
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '4px 10px',
    borderRadius: '20px',
  },
  editBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  deleteBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--error)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  emptyRow: {
    padding: '48px',
    textAlign: 'center',
    color: 'var(--muted)',
  },
  toast: {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--dark)',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontWeight: 'bold',
    fontSize: '13px',
    zIndex: 99999,
    boxShadow: 'var(--shadow-lg)',
  },
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
