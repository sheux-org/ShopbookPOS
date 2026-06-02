'use client';

import React, { useState, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { Search, CheckCircle } from 'lucide-react';

import { InvoiceListTable } from '../../components/history/InvoiceListTable';
import { InvoiceDetailModal } from '../../components/history/InvoiceDetailModal';
import { useGetOrders, useGetOrderItems, useVoidOrder } from '../../hooks/useOrders';

interface OrderRecord {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  paymentMethod: string;
  status: string; // paid / voided
  discountValue: number;
  taxValue: number;
  taxRate: number;
  createdAt: number;
  dateStr: string;
  cashierName: string;
}

interface OrderItemRecord {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  price: number;
}

export default function OrderHistoryPage() {
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const employeeName = useAuthStore((s) => s.employeeName);

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Detail Modal States
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // React Query Hooks
  const {
    data: orders = [],
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGetOrders(searchQuery);

  const mappedOrders: OrderRecord[] = useMemo(() => {
    return orders.map((o) => ({
      id: o.id,
      invoiceNumber: o.invoiceNumber,
      totalAmount: o.totalAmount,
      paymentMethod: o.paymentMethod || 'cash',
      status: o.status || 'paid',
      discountValue: o.discountValue || 0,
      taxValue: o.taxValue || 0,
      taxRate: o.taxRate || 0,
      createdAt: o.createdAt,
      dateStr: new Date(o.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      cashierName: o.cashierName || employeeName || 'Cashier',
    }));
  }, [orders, employeeName]);

  const { data: orderItems = [] } = useGetOrderItems(selectedOrder?.id);
  const voidOrderMutation = useVoidOrder();

  // Trigger Toast notification
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  // View Receipt detail click
  const handleViewReceipt = (order: OrderRecord) => {
    setSelectedOrder(order);
    setShowReceipt(true);
  };

  // Void Invoice
  const handleVoidInvoice = async () => {
    if (!selectedOrder) return;
    if (selectedOrder.status === 'voided') {
      alert('This invoice has already been voided.');
      return;
    }
    if (!confirm(`Are you sure you want to VOID invoice ${selectedOrder.invoiceNumber}? This will revert product stock counts.`)) return;

    voidOrderMutation.mutate(
      {
        orderId: selectedOrder.id,
        invoiceNumber: selectedOrder.invoiceNumber,
      },
      {
        onSuccess: () => {
          triggerToast(`Invoice ${selectedOrder.invoiceNumber} voided! 🚫`);
          setShowReceipt(false);
          setSelectedOrder(null);
        },
        onError: (err) => {
          console.error('Failed to void invoice:', err);
          alert('Failed to void invoice due to internal storage error.');
        },
      }
    );
  };

  const handleCopyReceiptText = () => {
    if (!selectedOrder) return;

    const itemsText = orderItems
      .map((item) => `• ${item.quantity} x ${item.name} - Rs. ${(item.price * item.quantity).toLocaleString()}`)
      .join('\n');

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const shareContent = `
=================================
       ${activeBusiness?.name?.toUpperCase() || 'SHOPBOOK PARTNER'}
       ${activeBusiness?.category || 'Retail POS'}
       ${activeBusiness?.address || 'Sri Lanka'}
=================================
Invoice: ${selectedOrder.invoiceNumber}
Date: ${selectedOrder.dateStr}
Status: ${selectedOrder.status.toUpperCase()}
Cashier: ${selectedOrder.cashierName}
---------------------------------
Items:
${itemsText}
---------------------------------
Subtotal: Rs. ${subtotal.toLocaleString()}
Discount: Rs. ${selectedOrder.discountValue.toLocaleString()}
VAT Tax (${selectedOrder.taxRate}%): Rs. ${selectedOrder.taxValue.toLocaleString()}
---------------------------------
Total Amount: Rs. ${selectedOrder.totalAmount.toLocaleString()}
=================================
Thank you for shopping with us!
`;

    navigator.clipboard.writeText(shareContent);
    triggerToast('Receipt text copied to clipboard! 📋');
  };

  return (
    <div style={styles.workspace} className="fade-in">
      {toastMsg && (
        <div style={styles.toast}>
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Filter panel */}
      <div style={styles.filterRow}>
        <div style={styles.searchBox}>
          <Search size={18} color="var(--muted)" />
          <input
            type="text"
            placeholder="Search by invoice number, payment method, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        {mappedOrders.length > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>
            Showing {mappedOrders.length} sales records
          </span>
        )}
      </div>

      <InvoiceListTable 
        loading={loading}
        filteredOrders={mappedOrders}
        onViewReceipt={handleViewReceipt}
      />

      {hasNextPage && (
        <div style={styles.loadMoreContainer}>
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            style={styles.loadMoreBtn}
          >
            {isFetchingNextPage ? 'Loading more...' : 'Load More Invoices ⬇️'}
          </button>
        </div>
      )}

      <InvoiceDetailModal 
        isOpen={showReceipt}
        order={selectedOrder}
        items={orderItems}
        activeBusiness={activeBusiness}
        onClose={() => {
          setShowReceipt(false);
          setSelectedOrder(null);
        }}
        onVoid={handleVoidInvoice}
        onCopyText={handleCopyReceiptText}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  workspace: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: 'calc(100vh - 73px)',
    overflow: 'hidden',
  },
  filterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '4px',
  },
  searchBox: {
    flex: 1,
    maxWidth: '480px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 14px',
    boxShadow: 'var(--shadow)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: 'var(--dark)',
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
  loadMoreContainer: {
    display: 'flex',
    justifyContent: 'center',
    margin: '8px 0 16px 0',
  },
  loadMoreBtn: {
    padding: '8px 20px',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
    transition: 'background-color 0.2s',
  },
};
