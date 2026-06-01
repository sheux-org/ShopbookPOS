'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import database from '../../db/database';
import { Q } from '@nozbe/watermelondb';
import { 
  Search, Eye, Printer, X, CheckCircle, Trash2, ArrowLeft, 
  Calendar, CreditCard, DollarSign, Wallet, FileText, Share2, Ban, Sparkles
} from 'lucide-react';

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
  const router = useRouter();
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
  const [voiding, setVoiding] = useState(false);

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
        cashierName: employeeName || 'Cashier' // Default cashier name
      }));

      // Sort newest first
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

    setVoiding(true);
    try {
      await database.write(async () => {
        // 1. Fetch order record
        const orderRecord = await database.get('orders').find(selectedOrder.id);
        
        // 2. Revert inventory stock
        for (const item of selectedItems) {
          const matchedProducts = await database.get('products').query(Q.where('name', item.name)).fetch();
          if (matchedProducts.length > 0) {
            const product: any = matchedProducts[0];
            const currentStock = product.stockCount;
            const updatedStock = currentStock + item.quantity;
            
            // Revert stock
            await product.update((p: any) => {
              p.stockCount = updatedStock;
            });

            // Log adjustment
            await database.get('inventory_logs').create((log: any) => {
              log.product.set(product);
              log.type = 'in';
              log.quantity = item.quantity;
              log.reason = `Voided Invoice Sale ${selectedOrder.invoiceNumber}`;
            });
          }
        }

        // 3. Mark order as voided
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
    } finally {
      setVoiding(false);
    }
  };

  // Share receipt text copy
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

  // Subtotal calculations
  const subtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [selectedItems]);

  // Search filter
  const filteredOrders = useMemo(() => {
    return orders.filter(o => 
      o.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [orders, searchQuery]);

  return (
    <div style={styles.workspace} className="fade-in">
      {/* Toast notifications */}
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

      {/* Ledger lists Card */}
      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.emptyRow}>
            <div style={styles.spinner} />
            <p style={{ marginTop: '12px' }}>Loading historical sales logs...</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.trHead}>
                  <th style={styles.th}>Invoice Number</th>
                  <th style={styles.th}>Date & Time</th>
                  <th style={styles.th}>Cashier</th>
                  <th style={styles.th}>Payment Method</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Total Value</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Audit</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id} style={styles.trRow} className="history-table-row">
                    <td style={styles.td}>
                      <strong>{o.invoiceNumber}</strong>
                    </td>
                    <td style={styles.td}>{o.dateStr}</td>
                    <td style={styles.td}>{o.cashierName}</td>
                    <td style={styles.td}>
                      <span style={styles.methodBadge}>
                        {o.paymentMethod.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: o.status === 'voided' ? '#fff1f2' : '#f0fdf4',
                        color: o.status === 'voided' ? 'var(--error)' : 'var(--success)',
                        border: o.status === 'voided' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                      }}>
                        {o.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <strong style={{ color: o.status === 'voided' ? 'var(--muted)' : 'var(--primary)' }}>
                        Rs. {o.totalAmount.toLocaleString()}
                      </strong>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button onClick={() => handleViewReceipt(o)} style={styles.viewReceiptBtn}>
                        <Eye size={14} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} style={styles.emptyRow}>
                      <FileText size={36} color="var(--muted)" style={{ marginBottom: '8px' }} />
                      <h4>No matching transactions found</h4>
                      <p>Invoiced completed records will populate inside this list.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice receipt view modal */}
      {showReceipt && selectedOrder && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '420px', padding: '0px' }}>
            <div style={styles.receiptContainer} id="printable-history-receipt">
              <div style={styles.receiptHeader}>
                <span style={styles.receiptSparkle}><Sparkles size={16} /></span>
                <h3 style={styles.receiptStoreName}>{activeBusiness?.name || 'Shopbook POS Partner'}</h3>
                <p style={styles.receiptStoreAddress}>{activeBusiness?.address || 'Sri Lanka'}</p>
                <p style={styles.receiptStorePhone}>{activeBusiness?.phone || '+94 ** *** ****'}</p>
              </div>

              <div style={styles.receiptDivider} />

              <div style={styles.receiptMeta}>
                <div><strong>Invoice:</strong> {selectedOrder.invoiceNumber}</div>
                <div><strong>Date:</strong> {selectedOrder.dateStr}</div>
                <div><strong>Cashier:</strong> {selectedOrder.cashierName}</div>
                <div>
                  <strong>Status: </strong>
                  <span style={{ 
                    color: selectedOrder.status === 'voided' ? 'var(--error)' : 'var(--success)',
                    fontWeight: 'bold'
                  }}>{selectedOrder.status.toUpperCase()}</span>
                </div>
              </div>

              <div style={styles.receiptDivider} />

              {/* Items List */}
              <div style={styles.receiptItemsList}>
                <div style={{ ...styles.receiptItemRow, fontWeight: 'bold' }}>
                  <span style={{ flex: 2 }}>Item</span>
                  <span style={{ flex: 1, textAlign: 'center' }}>Qty</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
                </div>
                {selectedItems.map((item, idx) => (
                  <div key={idx} style={styles.receiptItemRow}>
                    <span style={{ flex: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>{item.quantity}</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>Rs. {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={styles.receiptDivider} />

              {/* Totals */}
              <div style={styles.receiptTotals}>
                <div style={styles.receiptTotalsRow}>
                  <span>Subtotal</span>
                  <span>Rs. {subtotal.toLocaleString()}</span>
                </div>
                {selectedOrder.discountValue > 0 && (
                  <div style={styles.receiptTotalsRow}>
                    <span>Discount</span>
                    <span>- Rs. {selectedOrder.discountValue.toLocaleString()}</span>
                  </div>
                )}
                <div style={styles.receiptTotalsRow}>
                  <span>VAT Tax ({selectedOrder.taxRate}%)</span>
                  <span>Rs. {selectedOrder.taxValue.toLocaleString()}</span>
                </div>
                <div style={{ ...styles.receiptTotalsRow, fontWeight: 'bold', fontSize: '15px', marginTop: '6px' }}>
                  <span>Total Due</span>
                  <span>Rs. {selectedOrder.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div style={styles.receiptDivider} />

              <div style={styles.receiptFooter}>
                <p>Payment Tender: {selectedOrder.paymentMethod.toUpperCase()}</p>
                <p style={{ marginTop: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>THANK YOU FOR YOUR PATRONAGE! 🇱🇰</p>
                <p style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '4px' }}>Shopbook POS Cloud Sync Audit</p>
              </div>
            </div>

            {/* Receipt actions footer */}
            <div style={styles.receiptActions}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => {
                    const printContents = document.getElementById('printable-history-receipt')?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContents) {
                      document.body.innerHTML = printContents;
                      window.print();
                      document.body.innerHTML = originalContents;
                      window.location.reload(); // Refresh to restore JS binders
                    }
                  }}
                  style={styles.printBtn}
                >
                  <Printer size={15} />
                  <span>Print PDF</span>
                </button>
                <button 
                  onClick={handleCopyReceiptText}
                  style={styles.copyBtn}
                >
                  <Share2 size={15} />
                  <span>Copy Text</span>
                </button>
              </div>

              {selectedOrder.status !== 'voided' && (
                <button 
                  onClick={handleVoidInvoice}
                  disabled={voiding}
                  style={styles.voidBtn}
                >
                  <Ban size={15} />
                  <span>{voiding ? 'Voiding In Progress...' : 'Void Invoice Ledger Transaction'}</span>
                </button>
              )}

              <button 
                onClick={() => setShowReceipt(false)}
                style={styles.receiptDoneBtn}
              >
                Close Audit Inspection
              </button>
            </div>
          </div>
        </div>
      )}
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
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  tableWrapper: {
    overflowY: 'auto',
    flex: 1,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
  },
  trHead: {
    borderBottom: '2px solid var(--border)',
    backgroundColor: 'var(--background)',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  th: {
    padding: '12px 16px',
    fontWeight: '700',
    color: 'var(--muted)',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  trRow: {
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '12px 16px',
    verticalAlign: 'middle',
    color: 'var(--dark)',
  },
  methodBadge: {
    fontSize: '10px',
    fontWeight: '600',
    backgroundColor: 'var(--light-blue)',
    color: 'var(--primary)',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid var(--accent-blue)',
  },
  statusBadge: {
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  viewReceiptBtn: {
    padding: '5px 10px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontWeight: '500',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  emptyRow: {
    padding: '64px',
    textAlign: 'center',
    color: 'var(--muted)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '2px solid rgba(0,0,0,0.1)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
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
  receiptContainer: {
    padding: '32px 24px',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  receiptHeader: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  receiptSparkle: {
    color: 'var(--yellow)',
  },
  receiptStoreName: {
    fontSize: '16px',
    fontWeight: 'bold',
    fontFamily: 'var(--font-sans)',
  },
  receiptStoreAddress: {
    color: 'var(--muted)',
  },
  receiptStorePhone: {
    color: 'var(--muted)',
  },
  receiptDivider: {
    borderTop: '1px dashed #d1d5db',
    margin: '16px 0',
  },
  receiptMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  receiptItemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  receiptItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTotals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  receiptTotalsRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  receiptFooter: {
    textAlign: 'center',
    marginTop: '16px',
  },
  receiptActions: {
    padding: '20px 24px',
    backgroundColor: 'var(--background)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  printBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  copyBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: '#ffffff',
    color: 'var(--dark)',
    border: '1px solid var(--border)',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  voidBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: '#fff1f2',
    color: 'var(--error)',
    border: '1px solid #fee2e2',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  receiptDoneBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--dark)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
  },
};
