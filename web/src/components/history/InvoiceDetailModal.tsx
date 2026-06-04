'use client';

import React, { useMemo, useState } from 'react';
import { Printer, Share2, Ban, Sparkles, X } from 'lucide-react';
import { useUserPermissions } from '../../hooks/useUserPermissions';

interface OrderRecord {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
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

interface InvoiceDetailModalProps {
  isOpen: boolean;
  order: OrderRecord | null;
  items: OrderItemRecord[];
  activeBusiness: { name?: string; address?: string; phone?: string; category?: string } | null;
  onClose: () => void;
  onVoid: () => Promise<void>;
  onCopyText: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  isOpen,
  order,
  items,
  activeBusiness,
  onClose,
  onVoid,
  onCopyText,
}) => {
  const [voiding, setVoiding] = useState(false);
  const { canPerform } = useUserPermissions();

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    const printContent = document.getElementById('printable-history-receipt');
    if (!printContent) return;

    // Create a temporary hidden iframe for standard-compliant printing without reloading
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
            <title>Invoice Receipt ${order.invoiceNumber}</title>
            <style>
              body {
                margin: 0;
                padding: 10px;
                font-family: monospace;
                font-size: 11px;
                color: #111827;
                width: 76mm; /* typical thermal size */
              }
              .receipt-header {
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
              }
              .receipt-store-name {
                font-size: 14px;
                font-weight: bold;
                margin: 0;
              }
              .receipt-store-address, .receipt-store-phone {
                margin: 2px 0;
                color: #4b5563;
              }
              .receipt-divider {
                border-top: 1px dashed #9ca3af;
                margin: 10px 0;
              }
              .receipt-meta {
                display: flex;
                flex-direction: column;
                gap: 3px;
              }
              .receipt-items-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
              }
              .receipt-item-row {
                display: flex;
                justify-content: space-between;
              }
              .receipt-totals {
                display: flex;
                flex-direction: column;
                gap: 4px;
              }
              .receipt-totals-row {
                display: flex;
                justify-content: space-between;
              }
              .receipt-footer {
                text-align: center;
                margin-top: 12px;
              }
            </style>
          </head>
          <body>
            <div class="receipt-header">
              <h3 class="receipt-store-name">${activeBusiness?.name || 'SHOPBOOK POS PARTNER'}</h3>
              <p class="receipt-store-address">${activeBusiness?.address || 'Sri Lanka'}</p>
              <p class="receipt-store-phone">${activeBusiness?.phone || '+94 ** *** ****'}</p>
            </div>

            <div class="receipt-divider"></div>

            <div class="receipt-meta">
              <div><strong>Invoice:</strong> ${order.invoiceNumber}</div>
              <div><strong>Date:</strong> ${order.dateStr}</div>
              <div><strong>Cashier:</strong> ${order.cashierName}</div>
              <div><strong>Status:</strong> ${order.status.toUpperCase()}</div>
            </div>

            <div class="receipt-divider"></div>

            <div class="receipt-items-list">
              <div class="receipt-item-row" style="font-weight: bold;">
                <span style="flex: 2;">Item</span>
                <span style="flex: 1; text-align: center;">Qty</span>
                <span style="flex: 1; text-align: right;">Price</span>
              </div>
              ${items
                .map(
                  (item) => `
                <div class="receipt-item-row">
                  <span style="flex: 2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</span>
                  <span style="flex: 1; text-align: center;">${item.quantity}</span>
                  <span style="flex: 1; text-align: right;">Rs. ${(item.price * item.quantity).toLocaleString()}</span>
                </div>
              `
                )
                .join('')}
            </div>

            <div class="receipt-divider"></div>

            <div class="receipt-totals">
              <div class="receipt-totals-row">
                <span>Subtotal</span>
                <span>Rs. ${subtotal.toLocaleString()}</span>
              </div>
              ${
                order.discountValue > 0
                  ? `
                <div class="receipt-totals-row">
                  <span>Discount</span>
                  <span>- Rs. ${order.discountValue.toLocaleString()}</span>
                </div>
              `
                  : ''
              }
              <div class="receipt-totals-row">
                <span>VAT Tax (${order.taxRate}%)</span>
                <span>Rs. ${order.taxValue.toLocaleString()}</span>
              </div>
              <div class="receipt-totals-row" style="font-weight: bold; font-size: 13px; margin-top: 4px;">
                <span>Total Due</span>
                <span>Rs. ${order.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div class="receipt-divider"></div>

            <div class="receipt-footer">
              <p>Payment Tender: \${order.paymentMethod.toUpperCase()}</p>
              \${(order.paymentMethod === 'card' || order.paymentMethod === 'bank') && order.bankName ? \`
                <p style="margin: 2px 0; color: #4b5563; font-size: 10px;">\${order.bankName} \${order.cardLastFour ? \`(**** \${order.cardLastFour})\` : ''}</p>
              \` : ''}
              <p style="font-weight: bold; margin-top: 4px;">THANK YOU FOR YOUR PATRONAGE! 🇱🇰</p>
            </div>
          </body>
        </html>
      `);
      doc.close();

      // Allow browser to load iframe styles before print
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 100);
    }
  };

  const handleVoidClick = async () => {
    setVoiding(true);
    try {
      await onVoid();
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalContent, maxWidth: '420px', padding: '0px' }}>
        <div style={styles.receiptContainer} id="printable-history-receipt">
          <div style={styles.receiptHeader}>
            <span style={styles.receiptSparkle}>
              <Sparkles size={16} />
            </span>
            <h3 style={styles.receiptStoreName}>
              {activeBusiness?.name || 'Shopbook POS Partner'}
            </h3>
            <p style={styles.receiptStoreAddress}>{activeBusiness?.address || 'Sri Lanka'}</p>
            <p style={styles.receiptStorePhone}>{activeBusiness?.phone || '+94 ** *** ****'}</p>
          </div>

          <div style={styles.receiptDivider} />

          <div style={styles.receiptMeta}>
            <div>
              <strong>Invoice:</strong> {order.invoiceNumber}
            </div>
            <div>
              <strong>Date:</strong> {order.dateStr}
            </div>
            <div>
              <strong>Cashier:</strong> {order.cashierName}
            </div>
            <div>
              <strong>Status: </strong>
              <span
                style={{
                  color: order.status === 'voided' ? 'var(--error)' : 'var(--success)',
                  fontWeight: 'bold',
                }}
              >
                {order.status.toUpperCase()}
              </span>
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
            {items.map((item, idx) => (
              <div key={idx} style={styles.receiptItemRow}>
                <span
                  style={{
                    flex: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.name}
                </span>
                <span style={{ flex: 1, textAlign: 'center' }}>{item.quantity}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  Rs. {(item.price * item.quantity).toLocaleString()}
                </span>
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
            {order.discountValue > 0 && (
              <div style={styles.receiptTotalsRow}>
                <span>Discount</span>
                <span>- Rs. {order.discountValue.toLocaleString()}</span>
              </div>
            )}
            <div style={styles.receiptTotalsRow}>
              <span>VAT Tax ({order.taxRate}%)</span>
              <span>Rs. {order.taxValue.toLocaleString()}</span>
            </div>
            <div
              style={{
                ...styles.receiptTotalsRow,
                fontWeight: 'bold',
                fontSize: '15px',
                marginTop: '6px',
              }}
            >
              <span>Total Due</span>
              <span>Rs. {order.totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div style={styles.receiptDivider} />

          <div style={styles.receiptFooter}>
            <p>Payment Tender: {order.paymentMethod.toUpperCase()}</p>
            {(order.paymentMethod === 'card' || order.paymentMethod === 'bank') &&
              order.bankName && (
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  {order.bankName} {order.cardLastFour ? `(**** ${order.cardLastFour})` : ''}
                </p>
              )}
            <p style={{ marginTop: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              THANK YOU FOR YOUR PATRONAGE! 🇱🇰
            </p>
            <p style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '4px' }}>
              Shopbook Mini POS Cloud Sync Audit
            </p>
          </div>
        </div>

        {/* Receipt actions footer */}
        <div style={styles.receiptActions}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handlePrint} style={styles.printBtn}>
              <Printer size={15} />
              <span>Print PDF</span>
            </button>
            <button onClick={onCopyText} style={styles.copyBtn}>
              <Share2 size={15} />
              <span>Copy Text</span>
            </button>
          </div>

          {order.status !== 'voided' && canPerform('delete', 'transactions') && (
            <button onClick={handleVoidClick} disabled={voiding} style={styles.voidBtn}>
              <Ban size={15} />
              <span>{voiding ? 'Voiding In Progress...' : 'Void Invoice Ledger Transaction'}</span>
            </button>
          )}

          <button onClick={onClose} style={styles.receiptDoneBtn}>
            Close Audit Inspection
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
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
