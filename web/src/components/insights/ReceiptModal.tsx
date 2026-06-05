'use client';

import React, { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { ReceiptPaper, printThermalReceipt } from '../pos/ReceiptPaper';

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
  const mappedOrder = useMemo(() => {
    if (!selectedReceipt) return null;
    return {
      invoiceNumber: selectedReceipt.invoiceNumber,
      totalAmount: selectedReceipt.totalAmount,
      paymentMethod: selectedReceipt.paymentMethod,
      discountValue: selectedReceipt.discountValue || 0,
      taxValue: selectedReceipt.taxValue || 0,
      taxRate: selectedReceipt.taxRate || 8,
      dateStr: selectedReceipt.date || '',
      cashierName: employeeName || 'Cashier',
      status: 'paid',
      cashReceived: selectedReceipt.cashReceived,
      changeDue: selectedReceipt.changeDue || 0,
      bankName: selectedReceipt.bankName,
      cardLastFour: selectedReceipt.cardLastFour,
    };
  }, [selectedReceipt, employeeName]);

  if (!isOpen || !selectedReceipt || !mappedOrder) return null;

  const handlePrint = () => {
    printThermalReceipt(mappedOrder, selectedReceipt.items, activeBusiness, mappedOrder.changeDue);
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.receiptContainer}>
          <ReceiptPaper
            order={mappedOrder}
            items={selectedReceipt.items}
            activeBusiness={activeBusiness}
            changeDue={mappedOrder.changeDue}
          />
        </div>

        {/* Receipt actions footer */}
        <div style={styles.receiptActions}>
          <button onClick={handlePrint} style={styles.printBtn}>
            <Printer size={15} />
            <span>Print Receipt</span>
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
    maxWidth: '420px',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    height: 'calc(100vh - 100px)',
    display: 'flex',
    flexDirection: 'column',
  },
  receiptContainer: {
    padding: '32px 24px 12px 24px',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontFamily: 'monospace',
    fontSize: '12px',
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  receiptActions: {
    padding: '20px 24px',
    backgroundColor: 'var(--background)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flexShrink: 0,
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
