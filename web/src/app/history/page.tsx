'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import database from '../../db/database';
import { Q } from '@nozbe/watermelondb';
import { Search, CheckCircle } from 'lucide-react';

import { InvoiceListTable } from '../../components/history/InvoiceListTable';
import { InvoiceDetailModal } from '../../components/history/InvoiceDetailModal';

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
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const employeeName = useAuthStore((s) => s.employeeName);

  // States
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Detail Modal States
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [selectedItems, setSelectedItems] = useState<OrderItemRecord[]>([]);

  // Trigger Toast notification
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  // Load orders from IndexedDB
  const loadOrders = async () => {
    if (typeof window === 'undefined') return;
    setLoading(true);
    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      let matchedBizId = '';
      if (activeBiz && activeBiz.id !== '0') {
        const matchedBiz = await database.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
        if (matchedBiz.length > 0) {
          matchedBizId = matchedBiz[0].id;
        }
      }

      let list: any[] = [];
      if (matchedBizId) {
        list = await database.get('orders').query(Q.where('business_id', matchedBizId)).fetch();
      } else {
        list = await database.get('orders').query().fetch();
      }

      const mapped: OrderRecord[] = list.map(o => ({
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod || 'cash',
        status: o.status || 'paid',
        discountValue: o.discountValue || 0,
        taxValue: o.taxValue || 0,
        taxRate: o.taxRate || 8,
        createdAt: o.createdAt,
        dateStr: new Date(o.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
        cashierName: employeeName || 'Cashier'
      }));

      setOrders(mapped.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadOrders();
    }
  }, [isLoggedIn, activeBusiness]);

  // View Receipt detail click
  const handleViewReceipt = async (order: OrderRecord) => {
    try {
      const dbItems = await database.get('order_items').query(Q.where('order_id', order.id)).fetch();
      const items: OrderItemRecord[] = dbItems.map((item: any) => ({
        id: item.id,
        productId: item.product_id || undefined,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }));

      setSelectedOrder(order);
      setSelectedItems(items);
      setShowReceipt(true);
    } catch (err) {
      console.error('Failed to load order items:', err);
    }
  };

  // Void Invoice
  const handleVoidInvoice = async () => {
    if (!selectedOrder) return;
    if (selectedOrder.status === 'voided') {
      alert('This invoice has already been voided.');
      return;
    }
    if (!confirm(`Are you sure you want to VOID invoice ${selectedOrder.invoiceNumber}? This will revert product stock counts.`)) return;

    try {
      await database.write(async () => {
        const orderRecord = await database.get('orders').find(selectedOrder.id);
        
        for (const item of selectedItems) {
          const matchedProducts = await database.get('products').query(Q.where('name', item.name)).fetch();
          if (matchedProducts.length > 0) {
            const product: any = matchedProducts[0];
            const currentStock = product.stockCount;
            const updatedStock = currentStock + item.quantity;
            
            await product.update((p: any) => {
              p.stockCount = updatedStock;
            });

            await database.get('inventory_logs').create((log: any) => {
              log.product.set(product);
              log.type = 'in';
              log.quantity = item.quantity;
              log.reason = `Voided Invoice Sale ${selectedOrder.invoiceNumber}`;
            });
          }
        }

        await orderRecord.update((ord: any) => {
          ord.status = 'voided';
        });
      });

      triggerToast(`Invoice ${selectedOrder.invoiceNumber} voided! 🚫`);
      setShowReceipt(false);
      loadOrders();
    } catch (err) {
      console.error('Failed to void invoice:', err);
      alert('Failed to void invoice due to internal storage error.');
      throw err;
    }
  };

  const handleCopyReceiptText = () => {
    if (!selectedOrder) return;
    
    const itemsText = selectedItems
      .map(item => `• ${item.quantity} x ${item.name} - Rs. ${(item.price * item.quantity).toLocaleString()}`)
      .join('\n');

    const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

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

  const filteredOrders = useMemo(() => {
    return orders.filter(o => 
      o.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [orders, searchQuery]);

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
        {filteredOrders.length > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>
            Showing {filteredOrders.length} sales records
          </span>
        )}
      </div>

      <InvoiceListTable 
        loading={loading}
        filteredOrders={filteredOrders}
        onViewReceipt={handleViewReceipt}
      />

      <InvoiceDetailModal 
        isOpen={showReceipt}
        order={selectedOrder}
        items={selectedItems}
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
};
