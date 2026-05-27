'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import database from '../db/database';
import { Q } from '@nozbe/watermelondb';
import { 
  Search, Plus, CheckCircle, X, ShoppingBag, ShoppingCart
} from 'lucide-react';
import { useHardwareScanner } from '../components/Scanner';
import { ProductImage } from '../components/ProductImage';
import './page.css';


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

export default function PosBillingPage() {
  const router = useRouter();
  const cart = useCart((s) => s.cart);
  const addCartItem = useCart((s) => s.addCartItem);
  
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);

  // States
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'catalog'>('grid');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Add Product catalog quick modal
  const [showAddProdModal, setShowAddProdModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Snacks');
  const [newProdIcon, setNewProdIcon] = useState('📦');
  const [newProdStock, setNewProdStock] = useState('20');
  const [newProdQuickCode, setNewProdQuickCode] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');

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
      console.error('Failed to load products from IndexedDB:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadProducts();
    }
  }, [isLoggedIn, activeBusiness]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category.toLowerCase());
    });
    return ['All', ...Array.from(set).map(c => c.charAt(0).toUpperCase() + c.slice(1))];
  }, [products]);

  // Search and Category filters
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.quickCode && p.quickCode.includes(searchQuery)) ||
        (p.barcode && p.barcode.includes(searchQuery));
      const matchCat = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchSearch && matchCat;
    });
  }, [products, searchQuery, selectedCategory]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  // Scan handler
  const handleScanCode = (barcode: string) => {
    const matched = products.find(p => p.barcode === barcode || p.quickCode === barcode);
    if (matched) {
      if (matched.stockCount <= 0) {
        triggerToast(`Out of stock: ${matched.name} ⚠️`);
        return;
      }
      addCartItem(matched.name, matched.price, matched.icon, matched.barcode || matched.id, matched.stockCount);
      triggerToast(`Added ${matched.name} 🛒`);
    } else {
      triggerToast(`Barcode ${barcode} not in catalog ⚠️`);
    }
  };

  // Hardware Scanner Hook activation
  useHardwareScanner(handleScanCode);

  // Quick Catalog Add submit
  const handleAddCatalogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) return;

    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      let dbBiz: any;
      
      await database.write(async () => {
        const bizs = await database.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
        if (bizs.length > 0) {
          dbBiz = bizs[0];
        } else {
          dbBiz = await database.get('businesses').create((b: any) => {
            b.name = activeBiz.name;
            b.businessType = activeBiz.category;
            b.address = activeBiz.address;
            b.phoneNumber = activeBiz.phone;
          });
        }

        const newProd = await database.get('products').create((p: any) => {
          p.business.set(dbBiz);
          p.name = newProdName;
          p.price = parseFloat(newProdPrice);
          p.category = newProdCategory.toLowerCase();
          p.icon = newProdIcon;
          p.stockCount = parseInt(newProdStock) || 0;
          if (newProdQuickCode) p.quickCode = newProdQuickCode;
          if (newProdBarcode) p.barcode = newProdBarcode;
          p.isFavorite = false;
        });

        if (parseInt(newProdStock) > 0) {
          await database.get('inventory_logs').create((log: any) => {
            log.product.set(newProd);
            log.type = 'in';
            log.quantity = parseInt(newProdStock);
            log.reason = 'Initial Catalog Seed';
          });
        }
      });

      triggerToast(`Added ${newProdName} to Catalog! 📦`);
      setShowAddProdModal(false);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdQuickCode('');
      setNewProdBarcode('');
      setNewProdStock('20');
      loadProducts();
    } catch (err) {
      console.error('Failed to write new catalog product:', err);
    }
  };

  const cartTotalQuantity = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  return (
    <div style={styles.workspace} className="fade-in">
      {/* Toast popup */}
      {toastMsg && (
        <div style={styles.toast}>
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Catalog view container */}
      <div style={styles.catalogPane}>
        {/* Header query panel */}
        <div style={styles.searchRow} className="pos-search-row">
          <div style={styles.searchBox}>
            <Search size={18} color="var(--muted)" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          {/* View Mode Switcher Option */}
          <div style={styles.viewToggleGroup}>
            <button 
              onClick={() => setViewMode('grid')}
              style={{
                ...styles.viewToggleBtn,
                ...(viewMode === 'grid' ? styles.viewToggleBtnActive : {})
              }}
              title="Show standard Grid view"
            >
              Grid View
            </button>
            <button 
              onClick={() => setViewMode('catalog')}
              style={{
                ...styles.viewToggleBtn,
                ...(viewMode === 'catalog' ? styles.viewToggleBtnActive : {})
              }}
              title="Show POS catalog view"
            >
              POS Catalog
            </button>
          </div>

          {/* Cart Header Button (links to POS page) */}
          <button 
            onClick={() => router.push('/pos')}
            style={styles.cartHeaderBtn}
            className="pos-cart-header-btn"
            title="View active invoice cart"
          >
            <ShoppingCart size={18} />
            <span>Cart ({cartTotalQuantity})</span>
          </button>
        </div>

        {viewMode === 'grid' ? (
          <>
            {/* Category Tabs */}
            <div style={styles.categoryScroller}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    ...styles.categoryTab,
                    ...(selectedCategory === cat ? styles.categoryTabActive : {}),
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Catalog grid */}
            <div style={styles.productsGrid}>
              {filteredProducts.map((p) => {
                const isOut = p.stockCount <= 0;
                const isLow = p.lowStockAlert && p.stockCount <= p.lowStockAlert;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (isOut) {
                        triggerToast(`Out of stock: ${p.name} ⚠️`);
                        return;
                      }
                      addCartItem(p.name, p.price, p.icon, p.barcode || p.id, p.stockCount);
                      triggerToast(`Added ${p.name} 🛒`);
                    }}
                    style={{
                      ...styles.prodCard,
                      ...(isOut ? styles.prodCardOut : {}),
                    }}
                    className="product-grid-card"
                  >
                    <div style={styles.imageContainer}>
                      <ProductImage 
                        icon={p.icon} 
                        size={200} 
                        style={{ width: '100%', height: '100%', borderRadius: 0, border: 'none' }} 
                      />

                      {/* Stock Alert Badge */}
                      <span style={{
                        ...styles.stockBadge,
                        backgroundColor: isOut ? '#FEE2E2' : isLow ? '#FFEDD5' : '#DCFCE7',
                        color: isOut ? '#DC2626' : isLow ? '#D97706' : '#15803D',
                      }}>
                        {isOut ? 'Out of Stock' : `${p.stockCount} left`}
                      </span>
                    </div>

                    <div style={styles.prodCardDetails}>
                      <span style={styles.cardCategory}>{p.category || 'General'}</span>
                      <h3 style={styles.prodName}>{p.name}</h3>
                      <div style={styles.priceAddRow}>
                        <span style={styles.prodPrice}>Rs. {p.price.toLocaleString()}</span>
                        
                        <div 
                          style={{
                            ...styles.plusIconBadge,
                            backgroundColor: isOut ? '#E5E7EB' : 'var(--primary)',
                          }}
                          className="plus-icon-badge"
                        >
                          <Plus size={12} color={isOut ? 'var(--muted)' : '#FFFFFF'} />
                          <span style={{
                            ...styles.plusIconBadgeText,
                            color: isOut ? 'var(--muted)' : '#FFFFFF',
                          }}>Add</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div style={styles.emptyGridState}>
                  <ShoppingBag size={48} color="var(--muted)" />
                  <h3>No products found</h3>
                  <p>Try searching another item or add a new product to the catalog.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* POS style catalog layout */
          <div style={styles.catalogLayout}>
            {/* Category Sidebar */}
            <div style={styles.sidebar}>
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                const catEmoji = cat === 'All' ? '📦' :
                                 cat === 'Grocery' ? '🛒' :
                                 cat === 'Dairy' ? '🥛' :
                                 cat === 'Drinks' ? '🥤' :
                                 cat === 'Snacks' ? '🍿' :
                                 cat === 'Household' ? '🏠' : '📦';
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      ...styles.sidebarBtn,
                      ...(isActive ? styles.sidebarBtnActive : {})
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{catEmoji}</span>
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>

            {/* Catalog Products Grid */}
            <div style={styles.gridWrapper}>
              <div style={styles.productGrid}>
                {filteredProducts.map((p) => {
                  const isOut = p.stockCount <= 0;
                  const isLow = p.stockCount > 0 && p.stockCount <= 5;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (isOut) {
                          triggerToast(`Out of stock: ${p.name} ⚠️`);
                          return;
                        }
                        addCartItem(p.name, p.price, p.icon, p.barcode || p.id, p.stockCount);
                        triggerToast(`Added ${p.name} 🛒`);
                      }}
                      style={{
                        ...styles.productCard,
                        opacity: isOut ? 0.6 : 1,
                      }}
                      className="pos-catalog-card"
                    >
                      <ProductImage icon={p.icon} size={110} style={{ alignSelf: 'center', margin: '0', border: 'none', borderRadius: '10px' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <h4 style={styles.productName} title={p.name}>{p.name}</h4>
                        <span style={styles.productPrice}>Rs. {p.price}</span>
                        {isOut ? (
                          <span style={{ ...styles.productStock, ...styles.productStockOut }}>Out of Stock</span>
                        ) : isLow ? (
                          <span style={{ ...styles.productStock, ...styles.productStockLow }}>Low Stock ({p.stockCount})</span>
                        ) : (
                          <span style={styles.productStock}>Stock: {p.stockCount}</span>
                        )}
                      </div>
                      <button
                        disabled={isOut}
                        className="product-add-btn"
                        style={{
                          ...styles.productAddBtn,
                          ...(isOut ? styles.productAddBtnDisabled : {})
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  );
                })}
              </div>

              {filteredProducts.length === 0 && (
                <div style={styles.emptyGridState}>
                  <ShoppingBag size={48} color="var(--muted)" />
                  <h3>No products found</h3>
                  <p>Try searching another item or add a new product to the catalog.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Product catalog quick modal */}
      {showAddProdModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>Quick Register Product</h3>
              <button onClick={() => setShowAddProdModal(false)} style={styles.modalCloseBtn}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddCatalogSubmit} style={styles.modalBody}>
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Product Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Anchor Milk 400g" 
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  style={styles.modalInput}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Price (Rs.) *</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 850" 
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    style={styles.modalInput}
                    required
                  />
                </div>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Initial Stock *</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50" 
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    style={styles.modalInput}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Quick Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 101" 
                    value={newProdQuickCode}
                    onChange={(e) => setNewProdQuickCode(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Barcode</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 47900101" 
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Category</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Dairy / Snacks" 
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
                <div style={{ ...styles.modalInputGroup, flex: 1 }}>
                  <label style={styles.modalLabel}>Icon Emoji</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 🥛" 
                    value={newProdIcon}
                    onChange={(e) => setNewProdIcon(e.target.value)}
                    style={styles.modalInput}
                  />
                </div>
              </div>
              <button type="submit" style={styles.modalSubmitBtn}>
                Register Product
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
    height: '100%',
    overflowY: 'hidden', // keeps header/filters fixed
  },
  catalogPane: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  searchRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  searchBox: {
    flex: 1,
    minWidth: '220px',
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
  manualBarcodeForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '4px 8px',
    boxShadow: 'var(--shadow)',
    width: '220px',
  },
  manualBarcodeInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '12px',
    color: 'var(--dark)',
    backgroundColor: 'transparent',
  },
  manualBarcodeBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  addCatalogBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 18px',
    borderRadius: 'var(--radius)',
    backgroundColor: '#effaf3',
    border: '1px solid #cceadb',
    color: 'var(--success)',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
  },
  cartHeaderBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)',
    transition: 'all 0.2s ease',
  },
  categoryScroller: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    marginBottom: '20px',
    paddingBottom: '6px',
    flexShrink: 0,
  },
  categoryTab: {
    padding: '8px 18px',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  categoryTabActive: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    borderColor: 'var(--primary)',
    boxShadow: '0 4px 6px rgba(37, 99, 235, 0.15)',
  },
  productsGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '24px',
    overflowY: 'auto',
    paddingBottom: '24px',
  },
  prodCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    position: 'relative',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
    height: '295px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  prodCardOut: {
    opacity: 0.8,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: '195px',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid var(--border)',
    overflow: 'hidden',
  },
  prodImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  prodEmoji: {
    fontSize: '36px',
  },
  stockBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    fontSize: '9px',
    fontWeight: '800',
    padding: '2px 8px',
    borderRadius: '20px',
    letterSpacing: '0.3px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  prodCardDetails: {
    padding: '8px 12px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'space-between',
  },
  cardCategory: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '2px',
    display: 'block',
  },
  prodName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--dark)',
    lineHeight: '1.3',
    marginBottom: '4px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    height: '36px',
  },
  priceAddRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  prodPrice: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--primary)',
  },
  plusIconBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    height: '28px',
    borderRadius: '8px',
    padding: '0 8px',
    transition: 'all 0.2s',
  },
  plusIconBadgeText: {
    fontSize: '12px',
    fontWeight: 'bold',
  },
  emptyGridState: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center',
    gap: '8px',
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
  },
  viewToggleGroup: {
    display: 'flex',
    backgroundColor: '#f3f4f6',
    padding: '4px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    gap: '2px',
  },
  viewToggleBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  viewToggleBtnActive: {
    backgroundColor: '#ffffff',
    color: 'var(--primary)',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },
  catalogLayout: {
    display: 'flex',
    flex: 1,
    gap: '16px',
    height: '100%',
    minHeight: 0,
    marginTop: '16px',
  },
  sidebar: {
    width: '100px',
    backgroundColor: '#f3f4f6',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '8px',
    overflowY: 'auto',
    flexShrink: 0,
  },
  sidebarBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 6px',
    borderRadius: 'var(--radius)',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    gap: '4px',
    transition: 'all 0.2s',
  },
  sidebarBtnActive: {
    backgroundColor: '#ffffff',
    color: 'var(--primary)',
    boxShadow: 'var(--shadow)',
  },
  gridWrapper: {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '4px',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: '16px',
    paddingBottom: '16px',
  },
  productCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    boxSizing: 'border-box',
    position: 'relative',
    height: '235px',
  },
  productName: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--dark)',
    lineHeight: '1.3',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  productPrice: {
    fontSize: '14px',
    fontWeight: '800',
    color: 'var(--primary)',
  },
  productStock: {
    fontSize: '10px',
    color: 'var(--muted)',
  },
  productStockLow: {
    color: 'var(--warning)',
    fontWeight: 'bold',
  },
  productStockOut: {
    color: 'var(--error)',
    fontWeight: 'bold',
  },
  productAddBtn: {
    width: '100%',
    padding: '8px 0',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  productAddBtnDisabled: {
    backgroundColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
};
