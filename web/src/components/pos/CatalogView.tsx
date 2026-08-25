'use client';

import React, { useRef, useEffect } from 'react';
import { Search, ShoppingBag, Plus } from 'lucide-react';
import { ProductImage } from '../ProductImage';
import { useBusinessStore } from '../../stores/businessStore';
import { getCategoryEmoji } from '../../utils/businessTypeConfig';
import { useTranslation } from '../../hooks/useTranslation';

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

interface CatalogViewProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  viewMode: 'grid' | 'catalog';
  setViewMode: (val: 'grid' | 'catalog') => void;
  categories: string[];
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  filteredProducts: DBProduct[];
  addCartItem: (name: string, price: number, icon: string, sku: string, maxStock: number) => void;
  triggerToast: (msg: string) => void;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  categories,
  selectedCategory,
  setSelectedCategory,
  filteredProducts,
  addCartItem,
  triggerToast,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
}) => {
  const { t } = useTranslation();
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasNextPage || !fetchNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: '250px' }
    );
    const target = sentinelRef.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
      observer.disconnect();
    };
  }, [hasNextPage, fetchNextPage, isFetchingNextPage, filteredProducts.length]);
  return (
    <div style={styles.catalogPane}>
      {/* Header query search panel */}
      <div style={styles.searchRow}>
        <div style={styles.searchBox}>
          <Search size={18} color="var(--muted)" />
          <input
            type="text"
            placeholder="Search products by code, barcode, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* Grid vs Sidebar switcher */}
        <div style={styles.viewToggleGroup}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              ...styles.viewToggleBtn,
              ...(viewMode === 'grid' ? styles.viewToggleBtnActive : {}),
            }}
          >
            Grid View
          </button>
          <button
            onClick={() => setViewMode('catalog')}
            style={{
              ...styles.viewToggleBtn,
              ...(viewMode === 'catalog' ? styles.viewToggleBtnActive : {}),
            }}
          >
            POS Catalog
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <>
          {/* Category selector tabs */}
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

          {/* Products Grid list */}
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
                      size={120}
                      style={{ width: '100%', height: '100%', borderRadius: 0, border: 'none' }}
                    />
                    <span
                      style={{
                        ...styles.stockBadge,
                        backgroundColor: isOut ? '#FEE2E2' : isLow ? '#FFEDD5' : '#DCFCE7',
                        color: isOut ? '#DC2626' : isLow ? '#D97706' : '#15803D',
                      }}
                    >
                      {isOut
                        ? 'Out of Stock'
                        : isLow
                          ? `Low Stock (${p.stockCount} left)`
                          : `${p.stockCount} left`}
                    </span>
                  </div>

                  <div style={styles.prodCardDetails}>
                    <span style={styles.cardCategory}>{p.category || 'General'}</span>
                    <h3 style={styles.prodName}>{p.name}</h3>
                    <div style={styles.priceAddRow}>
                      <span style={styles.prodPrice}>Rs. {p.price.toLocaleString()}</span>
                      {isOut ? (
                        <span
                          style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)' }}
                        >
                          Out of Stock
                        </span>
                      ) : (
                        <div style={styles.plusIconBadge} className="plus-icon-badge">
                          <Plus size={10} color="#FFFFFF" />
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#FFFFFF' }}>
                            Add
                          </span>
                        </div>
                      )}
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

            {/* Infinite Scroll Sentinel & Micro Loading Indicator */}
            {hasNextPage && <div ref={sentinelRef} style={{ height: '24px', width: '100%', gridColumn: '1 / -1', pointerEvents: 'none' }} />}
            {isFetchingNextPage && (
              <div style={styles.inlineLoaderContainer}>
                <div style={styles.inlineSpinner} />
                <span style={styles.inlineLoaderText}>{t('common.loading')}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        /* POS Sidebar + Catalog list layout */
        <div style={styles.catalogLayout}>
          <div style={styles.sidebar}>
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              const catEmoji =
                cat === 'All' ? '📦' : getCategoryEmoji(cat, activeBusiness?.category);
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    ...styles.sidebarBtn,
                    ...(isActive ? styles.sidebarBtnActive : {}),
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{catEmoji}</span>
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>

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
                    <div style={styles.catalogImageContainer}>
                      <ProductImage
                        icon={p.icon}
                        size={120}
                        style={{ width: '100%', height: '100%', borderRadius: 0, border: 'none' }}
                      />
                      {isOut && <span style={styles.stockBadgeOut}>Out of Stock</span>}
                      {isLow && !isOut && (
                        <span style={styles.stockBadgeLow}>Low: {p.stockCount} left</span>
                      )}
                    </div>
                    <div style={styles.catalogCardDetails}>
                      <div>
                        <h4 style={styles.productName} title={p.name}>
                          {p.name}
                        </h4>
                        <div style={styles.productPrice}>Rs. {p.price.toLocaleString()}</div>
                      </div>
                      <button
                        disabled={isOut}
                        className="product-add-btn"
                        style={{
                          ...styles.productAddBtn,
                          ...(isOut ? styles.productAddBtnDisabled : {}),
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Infinite Scroll Sentinel & Micro Loading Indicator */}
              {hasNextPage && <div ref={sentinelRef} style={{ height: '24px', width: '100%', gridColumn: '1 / -1', pointerEvents: 'none' }} />}
              {isFetchingNextPage && (
                <div style={styles.inlineLoaderContainer}>
                  <div style={styles.inlineSpinner} />
                  <span style={styles.inlineLoaderText}>{t('common.loading')}</span>
                </div>
              )}
            </div>

            {filteredProducts.length === 0 && (
              <div style={styles.emptyGridState}>
                <ShoppingBag size={48} color="var(--muted)" />
                <h3>No products found</h3>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  catalogPane: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flex: 1,
    overflow: 'hidden',
  },
  searchRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    boxShadow: 'var(--shadow)',
    minWidth: '240px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    color: 'var(--dark)',
  },
  viewToggleGroup: {
    display: 'flex',
    gap: '4px',
    border: '1px solid var(--border)',
    padding: '4px',
    borderRadius: '8px',
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  viewToggleBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    transition: 'all 0.2s ease',
  },
  viewToggleBtnActive: {
    backgroundColor: '#ffffff',
    color: 'var(--primary)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  categoryScroller: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    marginBottom: '16px',
    paddingBottom: '4px',
    flexShrink: 0,
  },
  categoryTab: {
    padding: '8px 16px',
    borderRadius: '20px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  categoryTabActive: {
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    borderColor: 'var(--primary)',
  },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: '14px',
    overflowY: 'auto',
    flex: 1,
    paddingRight: '4px',
    paddingTop: '8px',
    paddingBottom: '16px',
  },
  prodCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: 'var(--shadow)',
    height: '220px',
  },
  prodCardOut: {
    opacity: 0.5,
  },
  imageContainer: {
    position: 'relative',
    height: '120px',
    backgroundColor: '#f3f4f6',
    flexShrink: 0,
    flexGrow: 0,
    overflow: 'hidden',
  },
  stockBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    fontSize: '9px',
    fontWeight: '800',
    padding: '2px 6px',
    borderRadius: '10px',
  },
  prodCardDetails: {
    padding: '10px 12px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  cardCategory: {
    fontSize: '10px',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  prodName: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    margin: '2px 0 6px 0',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    height: '32px',
    lineHeight: '1.3',
  },
  priceAddRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  prodPrice: {
    fontSize: '13px',
    fontWeight: '800',
    color: 'var(--primary)',
  },
  plusIconBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '4px 8px',
    borderRadius: '12px',
    backgroundColor: 'var(--primary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  },
  emptyGridState: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center',
    color: 'var(--muted)',
    gap: '8px',
  },
  catalogLayout: {
    display: 'flex',
    gap: '16px',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '160px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flexShrink: 0,
    overflowY: 'auto',
  },
  sidebarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontSize: '12px',
    fontWeight: 'bold',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: 'var(--shadow)',
  },
  sidebarBtnActive: {
    backgroundColor: 'var(--light-blue)',
    color: 'var(--primary)',
    boxShadow: 'none',
  },
  gridWrapper: {
    flex: 1,
    overflowY: 'auto',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '12px',
  },
  productCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '0',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.15s ease',
    boxShadow: 'var(--shadow)',
    height: '210px',
    overflow: 'hidden',
  },
  catalogImageContainer: {
    position: 'relative',
    height: '100px',
    backgroundColor: '#f3f4f6',
    flexShrink: 0,
    flexGrow: 0,
    overflow: 'hidden',
  },
  catalogCardDetails: {
    padding: '10px 12px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    flex: 1,
    minHeight: 0,
  },
  productName: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  productPrice: {
    fontSize: '13px',
    fontWeight: '800',
    color: 'var(--primary)',
  },
  productStock: {
    fontSize: '10px',
    color: 'var(--muted)',
  },
  productStockOut: {
    color: 'var(--error)',
    fontWeight: 'bold',
  },
  productStockLow: {
    color: 'var(--yellow)',
    fontWeight: 'bold',
  },
  productAddBtn: {
    width: '100%',
    padding: '6px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '11px',
    cursor: 'pointer',
    textAlign: 'center',
  },
  productAddBtnDisabled: {
    backgroundColor: '#e2e8f0',
    color: '#94a3b8',
    cursor: 'not-allowed',
  },
  inlineLoaderContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px 0 24px 0',
    width: '100%',
    gridColumn: '1 / -1',
  },
  inlineSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  inlineLoaderText: {
    fontSize: '12px',
    color: 'var(--muted)',
    fontWeight: '500',
  },
};
