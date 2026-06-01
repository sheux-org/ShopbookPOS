'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import database from '../../db/database';
import { Q } from '@nozbe/watermelondb';
import { Search, CheckCircle } from 'lucide-react';
import './catalog.css';

import { CatalogList } from '../../components/catalog/CatalogList';
import { RegisterProductModal } from '../../components/catalog/RegisterProductModal';

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

export default function CatalogManagerPage() {
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
  const [selectedProduct, setSelectedProduct] = useState<DBProduct | null>(null);

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
      setSelectedProduct(null);
      setModalMode('create');
      setShowModal(true);
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

  // Submit Modal form
  const handleFormSubmit = async (formData: {
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
  }) => {
    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      
      await database.write(async () => {
        const bizs = await database.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
        const dbBiz = bizs[0];

        if (modalMode === 'create') {
          const newProd = await database.get('products').create((p: any) => {
            p.business.set(dbBiz);
            p.name = formData.name;
            p.price = formData.price;
            p.category = formData.category.toLowerCase();
            p.icon = formData.icon;
            p.stockCount = formData.stockCount;
            p.unitType = formData.unitType;
            p.costPrice = formData.costPrice;
            if (formData.quickCode) p.quickCode = formData.quickCode;
            if (formData.barcode) p.barcode = formData.barcode;
            p.lowStockAlert = formData.lowStockAlert;
            p.isFavorite = false;
          });

          if (formData.stockCount > 0) {
            await database.get('inventory_logs').create((log: any) => {
              log.product.set(newProd);
              log.type = 'in';
              log.quantity = formData.stockCount;
              log.reason = 'Initial Seed';
            });
          }
          triggerToast('New item added! 📦');
        } else if (modalMode === 'edit' && selectedProduct) {
          const record: any = await database.get('products').find(selectedProduct.id);
          const oldStock = record.stockCount;
          const newStock = formData.stockCount;

          await record.update((p: any) => {
            p.name = formData.name;
            p.price = formData.price;
            p.category = formData.category.toLowerCase();
            p.icon = formData.icon;
            p.stockCount = newStock;
            p.unitType = formData.unitType;
            p.costPrice = formData.costPrice;
            p.quickCode = formData.quickCode || null;
            p.barcode = formData.barcode || null;
            p.lowStockAlert = formData.lowStockAlert;
          });

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

      loadProducts();
    } catch (err) {
      console.error('Failed to save product details:', err);
      throw err;
    }
  };

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

      <CatalogList 
        filteredProducts={filteredProducts}
        onToggleFavorite={toggleFavorite}
        onEditProduct={(p) => {
          setSelectedProduct(p);
          setModalMode('edit');
          setShowModal(true);
        }}
        onDeleteProduct={handleDeleteProduct}
      />

      <RegisterProductModal 
        isOpen={showModal}
        mode={modalMode}
        product={selectedProduct}
        onClose={() => {
          setShowModal(false);
          setSelectedProduct(null);
        }}
        onSubmit={handleFormSubmit}
      />
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
};
