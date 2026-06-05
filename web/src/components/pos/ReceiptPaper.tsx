'use client';

import React, { useMemo } from 'react';

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

export const cleanInvoiceNumber = (invoiceNumber: string) => {
  if (!invoiceNumber) return '';
  return invoiceNumber.split(' (Staff:')[0].trim();
};

export const printThermalReceipt = (
  order: any,
  items: any[],
  activeBusiness: any,
  changeDue: number
) => {
  if (!order) return;

  const invoiceNum = cleanInvoiceNumber(order.invoiceNumber);
  const parts = order.dateStr ? order.dateStr.split(' ') : [];
  const datePart = parts[0] || '';
  const timePart = parts[1] || '';

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const statusStr = order.status ? order.status.toUpperCase() : 'PAID';

  // Parse fields as numbers to ensure safety
  const discountVal = parseFloat(order.discountValue as any) || 0;
  const taxVal = parseFloat(order.taxValue as any) || 0;
  const taxRateVal = parseFloat(order.taxRate as any) || 0;
  const totalAmountVal = parseFloat(order.totalAmount as any) || 0;

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
          <title>Invoice Receipt ${invoiceNum}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
            body {
              margin: 0;
              padding: 10px;
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              color: #000000;
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
              font-size: 16px;
              font-weight: bold;
              margin: 0;
              text-transform: uppercase;
            }
            .receipt-store-address, .receipt-store-phone {
              margin: 2px 0;
              font-size: 11px;
            }
            .receipt-divider {
              border-top: 1px dashed #000000;
              margin: 8px 0;
            }
            .receipt-meta {
              display: flex;
              flex-direction: column;
              gap: 3px;
              font-size: 11px;
            }
            .receipt-meta-row {
              display: flex;
              justify-content: space-between;
            }
            .receipt-items-list {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .receipt-item-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
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
              margin-top: 15px;
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <h3 class="receipt-store-name">${activeBusiness?.name?.trim() || 'SHOPBOOK POS PARTNER'}</h3>
            <p class="receipt-store-address">${activeBusiness?.address?.trim() || 'Sri Lanka'}</p>
            <p class="receipt-store-phone">${activeBusiness?.phone?.trim() || '+94 ** *** ****'}</p>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-meta">
            <div class="receipt-meta-row">
              <span><strong>Invoice:</strong> ${invoiceNum}</span>
              <span><strong>Date:</strong> ${datePart}</span>
            </div>
            <div class="receipt-meta-row">
              <span><strong>Cashier:</strong> ${order.cashierName}</span>
              <span><strong>Time:</strong> ${timePart}</span>
            </div>
            <div class="receipt-meta-row">
              <span><strong>Status:</strong> ${statusStr}</span>
            </div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-items-list">
            <div class="receipt-item-row" style="font-weight: bold; border-bottom: 1px dashed #000000; padding-bottom: 3px; margin-bottom: 3px;">
              <span style="flex: 2.5;">Item Description</span>
              <span style="flex: 0.8; text-align: center;">Qty</span>
              <span style="flex: 1.2; text-align: right;">Amount</span>
            </div>
            ${items
              .map(
                (item) => `
              <div class="receipt-item-row">
                <span style="flex: 2.5; word-wrap: break-word;">${item.name}</span>
                <span style="flex: 0.8; text-align: center;">${item.quantity}</span>
                <span style="flex: 1.2; text-align: right;">Rs. ${(item.price * item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-totals">
            <div class="receipt-totals-row">
              <span>Sub Total</span>
              <span>Rs. ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            ${
              discountVal > 0
                ? `
              <div class="receipt-totals-row">
                <span>Discount</span>
                <span>- Rs. ${discountVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            `
                : ''
            }
            ${
              taxRateVal > 0 || taxVal > 0
                ? `
              <div class="receipt-totals-row">
                <span>VAT (${taxRateVal}%)</span>
                <span>Rs. ${taxVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            `
                : ''
            }
            <div class="receipt-divider" style="margin: 4px 0;"></div>
            <div class="receipt-totals-row" style="font-weight: bold; font-size: 13px;">
              <span>NET TOTAL</span>
              <span>Rs. ${totalAmountVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div class="receipt-divider" style="margin: 4px 0;"></div>
            <div class="receipt-totals-row">
              <span>Payment Mode</span>
              <span style="text-transform: uppercase;">${order.paymentMethod}</span>
            </div>
            ${
              order.paymentMethod === 'cash'
                ? `
              <div class="receipt-totals-row">
                <span>Cash Tendered</span>
                <span>Rs. ${(order.cashReceived ?? order.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div class="receipt-totals-row" style="font-weight: bold;">
                <span>Change Due</span>
                <span>Rs. ${changeDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            `
                : ''
            }
            ${
              order.paymentMethod === 'card'
                ? `
              <div class="receipt-totals-row">
                <span>Card / Bank</span>
                <span>${order.bankName || ''} ${order.cardLastFour ? `(**** ${order.cardLastFour})` : ''}</span>
              </div>
            `
                : ''
            }
            ${
              order.paymentMethod === 'bank'
                ? `
              <div class="receipt-totals-row">
                <span>Bank Name</span>
                <span>${order.bankName || ''}</span>
              </div>
            `
                : ''
            }
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-footer">
            <p style="font-weight: bold; margin: 4px 0; font-size: 12px; letter-spacing: 0.5px;">THANK YOU, COME AGAIN!</p>
            <p style="margin: 4px 0; font-size: 10px; color: #555555;">Powered by Shopbook</p>
          </div>
        </body>
      </html>
    `);
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
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const [datePart, timePart] = useMemo(() => {
    if (!order?.dateStr) return ['', ''];
    const parts = order.dateStr.split(' ');
    return [parts[0] || '', parts[1] || ''];
  }, [order?.dateStr]);

  const discountVal = useMemo(() => {
    if (!order) return 0;
    const val = parseFloat(order.discountValue as any);
    return isNaN(val) ? 0 : val;
  }, [order?.discountValue]);

  const taxVal = useMemo(() => {
    if (!order) return 0;
    const val = parseFloat(order.taxValue as any);
    return isNaN(val) ? 0 : val;
  }, [order?.taxValue]);

  const taxRateVal = useMemo(() => {
    if (!order) return 0;
    const val = parseFloat(order.taxRate as any);
    return isNaN(val) ? 0 : val;
  }, [order?.taxRate]);

  const totalAmountVal = useMemo(() => {
    if (!order) return 0;
    const val = parseFloat(order.totalAmount as any);
    return isNaN(val) ? 0 : val;
  }, [order?.totalAmount]);

  if (!order) return null;
  const statusStr = order.status ? order.status.toUpperCase() : 'PAID';

  return (
    <div style={styles.receiptPaperContainer}>
      {/* Sticky Header Section */}
      <div style={styles.receiptFixedHeader}>
        <div style={styles.receiptHeader}>
          <h3 style={styles.receiptStoreName}>
            {activeBusiness?.name?.trim() || 'Shopbook POS Partner'}
          </h3>
          <p style={styles.receiptStoreAddress}>{activeBusiness?.address?.trim() || 'Sri Lanka'}</p>
          <p style={styles.receiptStorePhone}>
            {activeBusiness?.phone?.trim() || '+94 ** *** ****'}
          </p>
        </div>

        <div style={styles.receiptDivider} />

        <div style={styles.receiptMeta}>
          <div>
            <strong>Invoice:</strong> {cleanInvoiceNumber(order.invoiceNumber)}
          </div>
          <div>
            <strong>Cashier:</strong> {order.cashierName}
          </div>
          <div>
            <strong>Date:</strong> {datePart}
          </div>
          <div>
            <strong>Time:</strong> {timePart}
          </div>
          <div>
            <strong>Status: </strong>
            <span
              style={{
                color: order.status === 'voided' ? 'var(--error)' : 'var(--success)',
                fontWeight: 'bold',
              }}
            >
              {statusStr}
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
                Rs.{' '}
                {(item.price * item.quantity).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          ))}
        </div>

        <div style={styles.receiptDivider} />

        {/* Totals */}
        <div style={styles.receiptTotals}>
          <div style={styles.receiptTotalsRow}>
            <span>Subtotal</span>
            <span>
              Rs.{' '}
              {subtotal.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          {discountVal > 0 && (
            <div style={styles.receiptTotalsRow}>
              <span>Discount</span>
              <span>
                - Rs.{' '}
                {discountVal.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
          {(taxRateVal > 0 || taxVal > 0) && (
            <div style={styles.receiptTotalsRow}>
              <span>VAT Tax ({taxRateVal}%)</span>
              <span>
                Rs.{' '}
                {taxVal.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
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
            <span>
              Rs.{' '}
              {totalAmountVal.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        <div style={styles.receiptDivider} />

        <div style={styles.receiptFooter}>
          <p style={{ margin: '4px 0', textTransform: 'uppercase' }}>
            Payment Mode: {order.paymentMethod}
          </p>
          {order.paymentMethod === 'cash' && (
            <>
              <p style={{ margin: '4px 0' }}>
                Cash Tendered: Rs.{' '}
                {(order.cashReceived ?? order.totalAmount).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p style={{ margin: '4px 0', fontWeight: 'bold' }}>
                Change Due: Rs.{' '}
                {changeDue.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </>
          )}
          {order.paymentMethod === 'card' && (
            <p style={{ margin: '4px 0' }}>
              Card / Bank: {order.bankName || ''}{' '}
              {order.cardLastFour ? `(**** ${order.cardLastFour})` : ''}
            </p>
          )}
          {order.paymentMethod === 'bank' && (
            <p style={{ margin: '4px 0' }}>Bank Name: {order.bankName || ''}</p>
          )}
          <div style={styles.receiptDivider} />
          <p
            style={{
              marginTop: '8px',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              fontSize: '13px',
            }}
          >
            THANK YOU, COME AGAIN!
          </p>
          <p style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
            Powered by Shopbook
          </p>
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
