import React from 'react';
import { Sparkles, Printer } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReceipt: any;
  receiptSubtotal: number;
  activeBusiness: any;
  employeeName: string;
}

export default function ReceiptModal({
  isOpen,
  onClose,
  selectedReceipt,
  receiptSubtotal,
  activeBusiness,
  employeeName,
}: ReceiptModalProps) {
  if (!isOpen || !selectedReceipt) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalContent, maxWidth: '420px', padding: '0px' }}>
        <div style={styles.receiptContainer} id="printable-receipt-view">
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
              <strong>Invoice:</strong> {selectedReceipt.invoiceNumber}
            </div>
            <div>
              <strong>Date:</strong> {selectedReceipt.date}
            </div>
            <div>
              <strong>Cashier:</strong> {employeeName}
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
            {selectedReceipt.items.map((item: any, idx: number) => (
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
              <span>Rs. {receiptSubtotal.toLocaleString()}</span>
            </div>
            {selectedReceipt.discountValue > 0 && (
              <div style={styles.receiptTotalsRow}>
                <span>Discount</span>
                <span>- Rs. {selectedReceipt.discountValue.toLocaleString()}</span>
              </div>
            )}
            <div style={styles.receiptTotalsRow}>
              <span>VAT Tax (8%)</span>
              <span>Rs. {selectedReceipt.taxValue.toLocaleString()}</span>
            </div>
            <div
              style={{
                ...styles.receiptTotalsRow,
                fontWeight: 'bold',
                fontSize: '15px',
                marginTop: '6px',
              }}
            >
              <span>Total Amount</span>
              <span>Rs. {selectedReceipt.totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div style={styles.receiptDivider} />

          <div style={styles.receiptFooter}>
            <p>Method: {selectedReceipt.paymentMethod.toUpperCase()}</p>
            <p style={{ marginTop: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              THANK YOU FOR YOUR VISIT! 🇱🇰
            </p>
            <p style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '4px' }}>
              Powered by Shopbook Mini POS Pro
            </p>
          </div>
        </div>

        {/* Receipt actions footer */}
        <div style={styles.receiptActions}>
          <button
            onClick={() => {
              const printContents = document.getElementById('printable-receipt-view')?.innerHTML;
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
            <Printer size={16} />
            <span>Print receipt (PDF)</span>
          </button>
          <button onClick={onClose} style={styles.receiptDoneBtn}>
            Close Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

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
    maxWidth: '440px',
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
    width: '100%',
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
