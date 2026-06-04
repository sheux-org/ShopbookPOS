'use client';

import React, { useState, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { Search, CheckCircle, FileSpreadsheet, FileText } from 'lucide-react';

import { InvoiceListTable } from '../../components/history/InvoiceListTable';
import { InvoiceDetailModal } from '../../components/history/InvoiceDetailModal';
import { useGetOrders, useGetOrderItems, useVoidOrder } from '../../hooks/useOrders';
import { useUserPermissions } from '../../hooks/useUserPermissions';

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
  bankName?: string;
  cardLastFour?: string;
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
  const { isRoleAtLeast } = useUserPermissions();
  const canExport = isRoleAtLeast('manager'); // Only manager & admin can export reports

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
      bankName: o.bankName || '',
      cardLastFour: o.cardLastFour || '',
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
    if (
      !confirm(
        `Are you sure you want to VOID invoice ${selectedOrder.invoiceNumber}? This will revert product stock counts.`
      )
    )
      return;

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
      .map(
        (item) =>
          `• ${item.quantity} x ${item.name} - Rs. ${(item.price * item.quantity).toLocaleString()}`
      )
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
Payment Tender: ${selectedOrder.paymentMethod.toUpperCase()} ${(selectedOrder.paymentMethod === 'card' || selectedOrder.paymentMethod === 'bank') && selectedOrder.bankName ? `\nPayment Info: ${selectedOrder.bankName} ${selectedOrder.cardLastFour ? `(**** ${selectedOrder.cardLastFour})` : ''}` : ''}
=================================
Thank you for shopping with us!
`;

    navigator.clipboard.writeText(shareContent);
    triggerToast('Receipt text copied to clipboard! 📋');
  };

  const handleExportExcel = () => {
    if (mappedOrders.length === 0) {
      alert('No transaction records to export.');
      return;
    }

    const headers = [
      'Invoice Number',
      'Date & Time',
      'Cashier',
      'Payment Method',
      'Bank/Brand',
      'Card Last 4',
      'Status',
      'Discount Value (Rs.)',
      'Tax Value (Rs.)',
      'Total Amount (Rs.)',
    ];

    const rows = mappedOrders.map((o) => [
      o.invoiceNumber,
      o.dateStr,
      o.cashierName,
      o.paymentMethod.toUpperCase(),
      o.bankName || '',
      o.cardLastFour ? `'${o.cardLastFour}` : '',
      o.status.toUpperCase(),
      o.discountValue.toString(),
      o.taxValue.toString(),
      o.totalAmount.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Invoice_Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Sales ledger report exported to CSV/Excel! 📊');
  };

  const handleExportPDF = () => {
    if (mappedOrders.length === 0) {
      alert('No transaction records to export.');
      return;
    }

    const nonVoided = mappedOrders.filter((o) => o.status !== 'voided');
    const totalSales = nonVoided.reduce((sum, o) => sum + o.totalAmount, 0);
    const activeCount = nonVoided.length;

    const cashSales = nonVoided
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const cardSales = nonVoided
      .filter((o) => o.paymentMethod === 'card')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const bankSales = nonVoided
      .filter((o) => o.paymentMethod === 'bank')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Invoice Sales Report</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                color: #1f2937;
                padding: 30px;
                margin: 0;
                line-height: 1.5;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 16px;
                margin-bottom: 24px;
              }
              .store-name {
                font-size: 20px;
                font-weight: 700;
                color: #111827;
              }
              .report-title {
                font-size: 24px;
                font-weight: 800;
                color: #2563eb;
                margin: 4px 0 0 0;
              }
              .meta-info {
                font-size: 12px;
                color: #6b7280;
                text-align: right;
              }
              .summary-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 16px;
                margin-bottom: 30px;
              }
              .summary-card {
                background-color: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 16px;
                text-align: center;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
              }
              .summary-val {
                font-size: 18px;
                font-weight: 700;
                color: #111827;
              }
              .summary-label {
                font-size: 10px;
                color: #6b7280;
                text-transform: uppercase;
                font-weight: 600;
                letter-spacing: 0.5px;
                margin-top: 4px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
              }
              th {
                background-color: #f3f4f6;
                color: #374151;
                font-weight: 700;
                padding: 10px 12px;
                text-align: left;
                border-bottom: 2px solid #d1d5db;
                text-transform: uppercase;
                font-size: 10px;
                letter-spacing: 0.5px;
              }
              td {
                padding: 10px 12px;
                border-bottom: 1px solid #e5e7eb;
              }
              tr.voided td {
                color: #9ca3af;
                text-decoration: line-through;
              }
              .badge {
                font-size: 10px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 4px;
                display: inline-block;
              }
              .badge-paid { background-color: #dcfce7; color: #166534; }
              .badge-voided { background-color: #fee2e2; color: #991b1b; }
              .badge-method { background-color: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
              .footer {
                text-align: center;
                margin-top: 40px;
                border-top: 1px dashed #d1d5db;
                padding-top: 16px;
                font-size: 11px;
                color: #9ca3af;
                font-weight: 500;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="store-name">${activeBusiness?.name?.toUpperCase() || 'SHOPBOOK PARTNER'}</div>
                <h1 class="report-title">Invoice Sales Report</h1>
              </div>
              <div class="meta-info">
                <div>Generated: ${new Date().toLocaleString()}</div>
                <div>Cashier: ${employeeName || 'System'}</div>
                <div>Records: ${mappedOrders.length} Invoices</div>
              </div>
            </div>

            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-val">Rs. ${totalSales.toLocaleString()}</div>
                <div class="summary-label">Net Sales Value</div>
              </div>
              <div class="summary-card">
                <div class="summary-val">Rs. ${cashSales.toLocaleString()}</div>
                <div class="summary-label">Cash Tendered</div>
              </div>
              <div class="summary-card">
                <div class="summary-val">Rs. ${(cardSales + bankSales).toLocaleString()}</div>
                <div class="summary-label">Card & Bank Sales</div>
              </div>
              <div class="summary-card">
                <div class="summary-val">${activeCount} / ${mappedOrders.length}</div>
                <div class="summary-label">Paid vs. Voided Invoices</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Date & Time</th>
                  <th>Cashier</th>
                  <th>Payment Method</th>
                  <th>Status</th>
                  <th style="text-align: right;">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                ${mappedOrders
                  .map(
                    (o) => `
                  <tr class="${o.status === 'voided' ? 'voided' : ''}">
                    <td><strong>${o.invoiceNumber}</strong></td>
                    <td>${o.dateStr}</td>
                    <td>${o.cashierName}</td>
                    <td>
                      <span class="badge badge-method">${o.paymentMethod.toUpperCase()}</span>
                      ${
                        (o.paymentMethod === 'card' || o.paymentMethod === 'bank') && o.bankName
                          ? `
                        <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">
                          ${o.bankName} ${o.cardLastFour ? `(**** ${o.cardLastFour})` : ''}
                        </div>
                      `
                          : ''
                      }
                    </td>
                    <td>
                      <span class="badge ${o.status === 'voided' ? 'badge-voided' : 'badge-paid'}">
                        ${o.status.toUpperCase()}
                      </span>
                    </td>
                    <td style="text-align: right; font-weight: bold;">
                      Rs. ${o.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>

            <div class="footer">
              Shopbook Mini POS &bull; Powered by Shopbook
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 150);
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

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {canExport && (
            <>
              <button onClick={handleExportExcel} style={styles.actionBtn}>
                <FileSpreadsheet size={15} />
                <span>Excel Export</span>
              </button>
              <button onClick={handleExportPDF} style={styles.actionBtn}>
                <FileText size={15} />
                <span>PDF Report</span>
              </button>
            </>
          )}
          {mappedOrders.length > 0 && (
            <span
              style={{
                fontSize: '12px',
                color: 'var(--muted)',
                fontWeight: '500',
                marginLeft: canExport ? '8px' : '0',
              }}
            >
              Showing {mappedOrders.length} sales records
            </span>
          )}
        </div>
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
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    height: 'calc(100vh - 73px)',
    overflow: 'hidden',
  },
  filterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
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
    fontSize: '13px',
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
  actionBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--dark)',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: 'var(--shadow)',
    transition: 'background-color 0.2s',
  },
};
