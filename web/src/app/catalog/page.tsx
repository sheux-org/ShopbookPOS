'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { Search, CheckCircle } from 'lucide-react';
import './catalog.css';

import { CatalogList } from '../../components/catalog/CatalogList';
import { RegisterProductModal } from '../../components/catalog/RegisterProductModal';
import {
  useProducts,
  useAddProduct,
  useUpdateProduct,
  useDeleteProduct,
  useToggleFavoriteProduct,
} from '../../hooks/useProducts';

const CATEGORIES = ['grocery', 'dairy', 'drinks', 'snacks', 'household'];

export default function CatalogManagerPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // CRUD Modals
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // React Query Hooks
  const {
    data: products = [],
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProducts(selectedCategoryFilter, searchQuery);

  const addProductMutation = useAddProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const toggleFavoriteMutation = useToggleFavoriteProduct();

  // Trigger Toast notifications
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

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
  const toggleFavorite = (productId: string, currentFav: boolean) => {
    toggleFavoriteMutation.mutate(
      { id: productId, isFavorite: currentFav },
      {
        onSuccess: () => {
          triggerToast(currentFav ? 'Removed from favorites' : 'Marked as favorite ⭐');
        },
      }
    );
  };

  // Delete product
  const handleDeleteProduct = (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${productName}" from the catalog?`)) return;
    deleteProductMutation.mutate(productId, {
      onSuccess: () => {
        triggerToast('Product deleted 🗑️');
      },
    });
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
      if (modalMode === 'create') {
        await addProductMutation.mutateAsync(formData);
        triggerToast('New item added! 📦');
      } else if (modalMode === 'edit' && selectedProduct) {
        await updateProductMutation.mutateAsync({
          id: selectedProduct.id,
          ...formData,
        });
        triggerToast('Item updated successfully!');
      }
      setShowModal(false);
      setSelectedProduct(null);
    } catch (err) {
      console.error('Failed to save product details:', err);
      throw err;
    }
  };

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

      {isLoading ? (
        <div style={styles.loadingState}>Loading catalog products...</div>
      ) : (
        <>
          <CatalogList
            filteredProducts={products}
            onToggleFavorite={toggleFavorite}
            onEditProduct={(p) => {
              setSelectedProduct(p);
              setModalMode('edit');
              setShowModal(true);
            }}
            onDeleteProduct={handleDeleteProduct}
          />

          {hasNextPage && (
            <div style={styles.loadMoreContainer}>
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                style={styles.loadMoreBtn}
              >
                {isFetchingNextPage ? 'Loading more...' : 'Load More Products ⬇️'}
              </button>
            </div>
          )}
        </>
      )}

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
    padding: '16px',
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
  loadingState: {
    textAlign: 'center',
    padding: '48px',
    color: 'var(--muted)',
    fontSize: '14px',
  },
  loadMoreContainer: {
    display: 'flex',
    justifyContent: 'center',
    margin: '16px 0 32px 0',
  },
  loadMoreBtn: {
    padding: '10px 24px',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
    transition: 'background-color 0.2s',
  },
};
