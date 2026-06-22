'use client';

import React from 'react';
import { buildReceiptModel, cleanInvoiceNumber, formatMoney } from '../../utils/receiptModel';
import { buildReceiptPrintHtml } from '../../utils/receiptHtml';

// Re-exported for existing consumers (InvoiceDetailModal, etc.).
export { cleanInvoiceNumber };

interface CartItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
}

interface ReceiptPaperProps {
  order: {
    invoiceNumber: string;
    totalAmount: number;
    paymentMethod: string;
    discountValue: number;
    discountType?: string;
    taxValue: number;
    taxRate: number;
    dateStr: string;
    cashierName: string;
    status?: string;
    cashReceived?: number;
    changeDue?: number;
    bankName?: string;
    cardLastFour?: string;
  } | null;
  items: CartItem[];
  activeBusiness: { name?: string; address?: string; phone?: string } | null;
  changeDue: number;
}

export const printThermalReceipt = (
  order: any,
  items: any[],
  activeBusiness: any,
  changeDue: number
) => {
  if (!order) return;

  const m = buildReceiptModel({ order, items, activeBusiness, changeDue });

  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(buildReceiptPrintHtml(m));
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      document.body.removeChild(iframe);
    }, 100);
  }
};

export const ReceiptPaper: React.FC<ReceiptPaperProps> = ({
  order,
  items,
  activeBusiness,
  changeDue,
}) => {
  if (!order) return null;

  const m = buildReceiptModel({ order, items, activeBusiness, changeDue });

  return (
    <div style={styles.receiptPaperContainer}>
      {/* Sticky Header Section */}
      <div style={styles.receiptFixedHeader}>
        <div style={styles.receiptHeader}>
          <h3 style={styles.receiptStoreName}>{m.businessName}</h3>
          <p style={styles.receiptStoreAddress}>{m.businessAddress}</p>
          <p style={styles.receiptStorePhone}>{m.businessPhone || '+94 ** *** ****'}</p>
        </div>

        <div style={styles.receiptDivider} />

        <div style={styles.receiptMeta}>
          <div>
            <strong>Invoice:</strong> {m.invoiceNumber}
          </div>
          <div>
            <strong>Cashier:</strong> {m.cashierName}
          </div>
          <div>
            <strong>Date:</strong> {m.date}
          </div>
          <div>
            <strong>Time:</strong> {m.time}
          </div>
          <div>
            <strong>Status: </strong>
            <span
              style={{
                color: m.isVoided ? 'var(--error)' : 'var(--success)',
                fontWeight: 'bold',
              }}
            >
              {m.status}
            </span>
          </div>
        </div>

        <div style={styles.receiptDivider} />

        <div style={styles.receiptTableHeader}>
          <span style={{ flex: 2 }}>Item</span>
          <span style={{ flex: 1, textAlign: 'center' }}>Qty</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
        </div>

        <div style={styles.receiptDivider} />
      </div>

      {/* Scrollable items and summary section */}
      <div style={styles.receiptScrollArea}>
        <div style={styles.receiptItemsList}>
          {m.items.map((item, idx) => (
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
              <span style={{ flex: 1, textAlign: 'right' }}>{formatMoney(item.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div style={styles.receiptDivider} />

        {/* Totals */}
        <div style={styles.receiptTotals}>
          <div style={styles.receiptTotalsRow}>
            <span>Subtotal</span>
            <span>{formatMoney(m.subtotal)}</span>
          </div>
          {m.discount && (
            <>
              <div style={styles.receiptTotalsRow}>
                <span>{m.discount.label}</span>
                <span>- {formatMoney(m.discount.amount)}</span>
              </div>
              <div style={styles.receiptTotalsRow}>
                <span>Net Subtotal</span>
                <span>{formatMoney(m.discount.netSubtotal)}</span>
              </div>
            </>
          )}
          {m.tax && (
            <div style={styles.receiptTotalsRow}>
              <span>{m.tax.label}</span>
              <span>{formatMoney(m.tax.amount)}</span>
            </div>
          )}
          <div
            style={{
              ...styles.receiptTotalsRow,
              fontWeight: 'bold',
              fontSize: '15px',
              marginTop: '6px',
            }}
          >
            <span>Total Paid</span>
            <span>{formatMoney(m.total)}</span>
          </div>
        </div>

        <div style={styles.receiptDivider} />

        <div style={styles.receiptFooter}>
          <p style={{ margin: '4px 0', textTransform: 'uppercase' }}>
            Payment Mode: {m.paymentMethod}
          </p>
          {m.cashTendered !== null && (
            <>
              <p style={{ margin: '4px 0' }}>Cash Tendered: {formatMoney(m.cashTendered)}</p>
              <p style={{ margin: '4px 0', fontWeight: 'bold' }}>
                Change Due: {formatMoney(m.changeDue ?? 0)}
              </p>
            </>
          )}
          {m.cardLabel && <p style={{ margin: '4px 0' }}>Card / Bank: {m.cardLabel}</p>}
          {m.bankName && <p style={{ margin: '4px 0' }}>Bank Name: {m.bankName}</p>}
          <div style={styles.receiptDivider} />
          <p
            style={{
              marginTop: '8px',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              fontSize: '13px',
            }}
          >
            {m.footer[0]}
          </p>
          <p style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>{m.footer[1]}</p>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  receiptPaperContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  receiptFixedHeader: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  receiptHeader: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  receiptStoreName: {
    fontSize: '16px',
    fontWeight: 'bold',
    fontFamily: 'var(--font-sans)',
  },
  receiptStoreAddress: {
    color: 'var(--muted)',
    fontSize: '11px',
    margin: '2px 0',
  },
  receiptStorePhone: {
    color: 'var(--muted)',
    fontSize: '11px',
    margin: '2px 0',
  },
  receiptDivider: {
    borderTop: '1px dashed #d1d5db',
    margin: '8px 0',
  },
  receiptMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  receiptTableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 'bold',
  },
  receiptScrollArea: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    paddingRight: '4px',
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
    paddingBottom: '8px',
  },
};
