'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '../../../stores/authStore';
import { useBusinessStore } from '../../../stores/businessStore';
import { useUserPermissions } from '../../../hooks/useUserPermissions';
import {
  ArrowLeft,
  Copy,
  Check,
  Edit2,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  TrendingUp,
  Package,
  History,
  Tag,
  Barcode,
  Calendar,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { ProductImage } from '../../../components/ProductImage';
import { AdjustStockModal } from '../../../components/stocks/AdjustStockModal';
import { RegisterProductModal } from '../../../components/catalog/RegisterProductModal';
import {
  useProduct,
  useGetStockHistory,
  useAdjustStock,
  useUpdateProduct,
  useDeleteProduct,
} from '../../../hooks/useProducts';

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const { canPerform } = useUserPermissions();

  // Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal states
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Copy indicator states
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Query Hooks
  const { data: product, isLoading: loadingProduct, error: productError } = useProduct(id);
  const { data: logs = [], isLoading: loadingLogs } = useGetStockHistory(id);

  // Mutation Hooks
  const adjustStockMutation = useAdjustStock();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();

  // Permission guard
  if (!canPerform('update', 'products')) {
    return (
      <div style={styles.restrictedContainer}>
        <div style={styles.restrictedCard}>
          <div style={styles.restrictedIconWrapper}>
            <Lock size={28} color="var(--error)" />
          </div>
          <h3 style={styles.restrictedTitle}>Inventory Operations Restricted</h3>
          <p style={styles.restrictedText}>
            Cashier profiles are not authorized to view individual product ledgers, update, or edit
            products in the catalog list.
          </p>
          <button onClick={() => router.push('/stocks')} style={styles.backBtn}>
            <ArrowLeft size={16} />
            <span>Return to Stocks</span>
          </button>
        </div>
      </div>
    );
  }

  if (loadingProduct) {
    return (
      <div style={styles.loaderContainer}>
        <Loader2 size={36} className="spin-anim" color="var(--primary)" />
        <span style={styles.loaderText}>Loading ledger details...</span>
      </div>
    );
  }

  if (productError || !product) {
    return (
      <div style={styles.restrictedContainer}>
        <div style={styles.restrictedCard}>
          <div style={styles.restrictedIconWrapper}>
            <Package size={28} color="var(--muted)" />
          </div>
          <h3 style={styles.restrictedTitle}>Product Ledger Not Found</h3>
          <p style={styles.restrictedText}>
            The product you are trying to view does not exist in this business catalog or has been
            deleted.
          </p>
          <button onClick={() => router.push('/stocks')} style={styles.backBtn}>
            <ArrowLeft size={16} />
            <span>Back to Stocks</span>
          </button>
        </div>
      </div>
    );
  }

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  const handleCopy = (text: string, type: 'barcode' | 'quickcode') => {
    if (!text) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Copy fallback failed', err);
      }
      document.body.removeChild(textArea);
    }
    setCopiedCode(type);
    triggerToast(`${type === 'barcode' ? 'Barcode' : 'Quick Code'} copied to clipboard! 📋`);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const handleAdjustSubmit = async (
    adjustType: 'in' | 'out',
    qtyNum: number,
    adjustReason: string
  ) => {
    try {
      await adjustStockMutation.mutateAsync({
        productId: id,
        quantity: qtyNum,
        type: adjustType,
        reason: adjustReason,
      });
      triggerToast(`Logged ${adjustType.toUpperCase()} adjustment successfully! 📈`);
      setShowAdjustModal(false);
    } catch (err) {
      console.error('Failed to adjust stock:', err);
    }
  };

  const handleEditSubmit = async (formData: any) => {
    try {
      await updateProductMutation.mutateAsync({
        id,
        name: formData.name,
        price: formData.price,
        costPrice: formData.costPrice,
        stockCount: formData.stockCount,
        lowStockAlert: formData.lowStockAlert,
        unitType: formData.unitType,
        category: formData.category,
        quickCode: formData.quickCode,
        barcode: formData.barcode,
        icon: formData.icon,
      });
      triggerToast('Product details updated successfully! 📦');
      setShowEditModal(false);
    } catch (err) {
      console.error('Failed to update product details:', err);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to permanently DELETE "${product.name}"? This action is irreversible and will delete all associated audit logs.`
      )
    ) {
      return;
    }

    try {
      await deleteProductMutation.mutateAsync(id);
      alert(`"${product.name}" has been deleted from catalog list.`);
      router.push('/stocks');
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('Failed to delete product. Please try again.');
    }
  };

  const profitAmount = product.price - (product.costPrice || 0);
  const profitMarginPercentage = product.price > 0 ? (profitAmount / product.price) * 100 : 0;
  const isOut = product.stockCount <= 0;
  const isLow = product.lowStockAlert && product.stockCount <= product.lowStockAlert;

  return (
    <div style={styles.container} className="fade-in">
      {/* Toast Notification */}
      {toastMsg && (
        <div style={styles.toast}>
          <CheckCircle size={16} color="#ffffff" style={{ marginRight: '6px' }} />
          <span>{toastMsg}</span>
        </div>
      )}

      <div style={styles.mainGrid} className="stocks-detail-grid">
        {/* Left Column: Back button + Product Details */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <div style={styles.topBar}>
            <button onClick={() => router.push('/stocks')} className="back-btn-pill">
              <ArrowLeft size={16} />
              <span>Back to Product Inventory</span>
            </button>
          </div>

          {/* Product Metadata & Image Card */}
          <div style={styles.detailsCard}>
            {/* Card Top Right Edit/Delete buttons (parallel to the product name) */}
            <div style={styles.topCardActions}>
              <button
                onClick={() => setShowEditModal(true)}
                className="action-btn-secondary"
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  borderRadius: '6px',
                  height: '26px',
                  gap: '4px',
                }}
              >
                <Edit2 size={11} />
                <span>Edit</span>
              </button>
              <button
                onClick={handleDelete}
                className="action-btn-danger"
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  borderRadius: '6px',
                  height: '26px',
                  gap: '4px',
                }}
              >
                <Trash2 size={11} />
                <span>Delete</span>
              </button>
            </div>

            {/* Top Info Section: Image & Badges on left, Metadata on right */}
            <div style={styles.topInfoSection}>
              <div style={styles.leftAvatarCol}>
                <ProductImage
                  icon={product.icon}
                  size={145}
                  style={{
                    border: 'none',
                    borderRadius: '16px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
                  }}
                />

                <div style={styles.badgeColumn}>
                  <span
                    style={{
                      ...styles.stockIndicator,
                      backgroundColor: isOut ? '#FEE2E2' : isLow ? '#FFEDD5' : '#DCFCE7',
                      color: isOut ? '#DC2626' : isLow ? '#D97706' : '#15803D',
                      textAlign: 'center',
                    }}
                  >
                    {product.stockCount} {product.unitType || 'Units'}
                    <div
                      style={{ fontSize: '8px', opacity: 0.8, marginTop: '2px', fontWeight: '500' }}
                    >
                      {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                    </div>
                  </span>
                  <span style={{ ...styles.categoryBadge, textAlign: 'center' }}>
                    {product.category.toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={styles.metaCol}>
                <h2 style={styles.productName}>{product.name}</h2>

                {/* Compact metadata fields with space-between */}
                <div style={styles.metaRowCompact}>
                  <span style={styles.metaLabelCompact}>Quick Code:</span>
                  <div style={styles.codeWrapper}>
                    <span style={styles.codeTextCompact}>
                      {product.quickCode ? `#${product.quickCode}` : 'None'}
                    </span>
                    {product.quickCode && (
                      <button
                        onClick={() => handleCopy(product.quickCode || '', 'quickcode')}
                        style={styles.copyBtnCompact}
                      >
                        {copiedCode === 'quickcode' ? (
                          <Check size={10} color="var(--success)" />
                        ) : (
                          <Copy size={10} />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div style={styles.metaRowCompact}>
                  <span style={styles.metaLabelCompact}>Barcode:</span>
                  <div style={styles.codeWrapper}>
                    <span style={styles.codeTextCompact}>{product.barcode || 'None'}</span>
                    {product.barcode && (
                      <button
                        onClick={() => handleCopy(product.barcode || '', 'barcode')}
                        style={styles.copyBtnCompact}
                      >
                        {copiedCode === 'barcode' ? (
                          <Check size={10} color="var(--success)" />
                        ) : (
                          <Copy size={10} />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div style={styles.metaRowCompact}>
                  <span style={styles.metaLabelCompact}>SKU / ID:</span>
                  <span style={styles.metaValCompact}>{product.sku || 'None'}</span>
                </div>

                <div style={styles.metaRowCompact}>
                  <span style={styles.metaLabelCompact}>Alert Level:</span>
                  <span style={styles.metaValCompact}>
                    {product.lowStockAlert ? `${product.lowStockAlert} Units` : 'None'}
                  </span>
                </div>

                <div style={styles.metaRowCompact}>
                  <span style={styles.metaLabelCompact}>Unit Type:</span>
                  <span style={styles.metaValCompact}>{product.unitType || 'Pieces'}</span>
                </div>

                <div style={styles.metaRowCompact}>
                  <span style={styles.metaLabelCompact}>Registered:</span>
                  <span style={styles.metaValCompact}>
                    {product.createdAt
                      ? new Date(product.createdAt).toLocaleDateString()
                      : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.divider} />

            {/* Details Table */}
            <div style={styles.infoGrid}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Retail Price</span>
                <span style={styles.infoValue}>
                  Rs. {product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Cost Price</span>
                <span style={styles.infoValue}>
                  Rs.{' '}
                  {product.costPrice
                    ? product.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })
                    : '0.00'}
                </span>
              </div>

              <div
                style={{
                  ...styles.infoRow,
                  backgroundColor: '#f0fdf4',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginTop: '4px',
                }}
              >
                <span style={{ ...styles.infoLabel, color: 'var(--success)' }}>Profit Margin</span>
                <span
                  style={{
                    ...styles.infoValue,
                    color: 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <TrendingUp size={14} />
                  <span>
                    Rs. {profitAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (
                    {profitMarginPercentage.toFixed(1)}%)
                  </span>
                </span>
              </div>
            </div>

            <div style={styles.divider} />

            {/* Action Row */}
            <div style={styles.actionsRow}>
              <button onClick={() => setShowAdjustModal(true)} style={styles.actionBtnPrimary}>
                <Plus size={16} />
                <span>Adjust Stock</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Log Ledger Scroll View */}
        <div style={styles.logsCard}>
          <div style={styles.logsHeader}>
            <History size={16} color="var(--primary)" />
            <h3 style={styles.logsTitle}>Product Inventory Log</h3>
          </div>

          <div style={styles.logsScroller}>
            {logs.map((log) => {
              const isIn = log.type === 'in';
              const logDate = new Date(log.createdAt).toLocaleString([], {
                dateStyle: 'short',
                timeStyle: 'short',
              });
              return (
                <div key={log.id} style={styles.logItem}>
                  <div style={styles.logItemTop}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={styles.logItemReason}>
                        {log.reason || (isIn ? 'Restock' : 'Deduction')}
                      </span>
                      <div style={styles.logItemDateRow}>
                        <Calendar size={11} color="var(--muted)" />
                        <span style={styles.logItemDate}>{logDate}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        ...styles.logBadge,
                        backgroundColor: isIn ? '#DCFCE7' : '#FEE2E2',
                        color: isIn ? '#16A34A' : '#DC2626',
                      }}
                    >
                      {isIn ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                      <span>
                        {isIn ? '+' : '-'}
                        {log.quantity} {product.unitType || 'Units'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {logs.length === 0 && (
              <div style={styles.emptyLogs}>
                <History size={32} color="var(--muted)" style={{ opacity: 0.4 }} />
                <p style={styles.emptyLogsText}>No audit transactions logged for this item yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Adjust Inventory Modal */}
      <AdjustStockModal
        isOpen={showAdjustModal}
        product={{
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          icon: product.icon,
          stockCount: product.stockCount,
          lowStockAlert: product.lowStockAlert,
          unitType: product.unitType,
          costPrice: product.costPrice,
          quickCode: product.quickCode,
          barcode: product.barcode,
        }}
        onClose={() => setShowAdjustModal(false)}
        onSubmit={handleAdjustSubmit}
      />

      {/* Edit Catalog Details Modal */}
      <RegisterProductModal
        isOpen={showEditModal}
        mode="edit"
        product={{
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          icon: product.icon,
          stockCount: product.stockCount,
          lowStockAlert: product.lowStockAlert,
          unitType: product.unitType,
          costPrice: product.costPrice,
          quickCode: product.quickCode,
          barcode: product.barcode,
          isFavorite: product.isFavorite,
        }}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '16px',
    height: 'calc(100vh - 73px)',
    overflow: 'hidden',
    backgroundColor: 'var(--background)',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  restrictedContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '24px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  restrictedCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '48px 32px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  restrictedIconWrapper: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#fee2e2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #fecaca',
  },
  restrictedTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    margin: 0,
  },
  restrictedText: {
    fontSize: '13px',
    color: 'var(--muted)',
    lineHeight: '1.6',
    margin: 0,
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '8px',
    boxShadow: 'var(--shadow)',
  },
  loaderContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
    color: 'var(--muted)',
  },
  loaderText: {
    fontSize: '13px',
    fontWeight: '500',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  backLink: {
    // Deprecated in favor of .back-btn-pill
  },
  topCardActions: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    display: 'flex',
    gap: '6px',
    zIndex: 10,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1.55fr 1fr',
    gap: '16px',
    flex: 1,
    overflow: 'hidden',
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    overflow: 'hidden',
    height: '100%',
    position: 'relative',
  },
  avatarSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
    marginTop: '4px',
  },
  productName: {
    fontSize: '18px',
    fontWeight: '800',
    color: 'var(--dark)',
    margin: 0,
    lineHeight: '1.3',
    paddingRight: '140px' /* Prevent overlapping with edit/delete buttons */,
  },
  badgeRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  stockIndicator: {
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: '12px',
  },
  categoryBadge: {
    fontSize: '9px',
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: '12px',
    backgroundColor: '#F3F4F6',
    color: '#4B5563',
    border: '1px solid #E5E7EB',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border)',
    margin: '18px 0',
    width: '100%',
  },
  infoGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    padding: '4px 0',
  },
  infoLabel: {
    color: 'var(--muted)',
    fontWeight: '500',
  },
  infoValue: {
    color: 'var(--dark)',
    fontWeight: '700',
  },
  codeWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  codeText: {
    fontWeight: '700',
    color: 'var(--dark)',
    backgroundColor: '#F3F4F6',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
  },
  copyBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: 'auto',
    paddingTop: '8px',
  },
  actionBtnPrimary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '11px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
  },
  cardBtnSecondary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: 'var(--dark)',
    border: '1px solid var(--border)',
    fontWeight: '600',
    fontSize: '11px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
    transition: 'background-color 0.15s ease',
  },
  cardBtnDanger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: 'var(--error)',
    border: '1px solid #fecaca',
    fontWeight: '600',
    fontSize: '11px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
    transition: 'background-color 0.15s ease',
  },
  topInfoSection: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start',
    width: '100%',
  },
  leftAvatarCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
    width: '150px',
  },
  badgeColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
  },
  metaCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  metaRowCompact: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    fontSize: '11px',
    padding: '3px 0',
    borderBottom: '1px dashed #f3f4f6',
  },
  metaLabelCompact: {
    color: 'var(--muted)',
    fontWeight: '500',
    fontSize: '11px',
  },
  metaValCompact: {
    color: 'var(--dark)',
    fontWeight: '700',
    fontSize: '11px',
  },
  codeTextCompact: {
    fontWeight: '700',
    color: 'var(--dark)',
    backgroundColor: '#F3F4F6',
    padding: '1px 5px',
    borderRadius: '4px',
    fontSize: '10px',
  },
  copyBtnCompact: {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    cursor: 'pointer',
    padding: '2px',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logsCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  logsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    flexShrink: 0,
  },
  logsTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--dark)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: 0,
  },
  logsScroller: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  logItem: {
    backgroundColor: 'var(--background)',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    padding: '12px 16px',
    transition: 'all 0.2s ease',
  },
  logItemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logItemReason: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  logItemDateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '4px',
  },
  logItemDate: {
    fontSize: '10px',
    color: 'var(--muted)',
  },
  logBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: '12px',
  },
  emptyLogs: {
    padding: '64px 20px',
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    justifyContent: 'center',
    height: '100%',
  },
  emptyLogsText: {
    margin: 0,
    opacity: 0.7,
  },
  toast: {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--success)',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '30px',
    fontWeight: 'bold',
    fontSize: '13px',
    zIndex: 99999,
    boxShadow: '0 10px 20px rgba(22, 163, 74, 0.25)',
  },
};
