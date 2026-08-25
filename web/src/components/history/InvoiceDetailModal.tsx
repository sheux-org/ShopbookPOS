'use client';

import React, { useState } from 'react';
import { Printer, Ban } from 'lucide-react';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ReceiptPaper, printThermalReceipt } from '../pos/ReceiptPaper';
import { useTranslation } from '../../hooks/useTranslation';

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
  cashReceived?: number;
  changeDue?: number;
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
}) => {
  const { t } = useTranslation();
  const [voiding, setVoiding] = useState(false);
  const { canPerform } = useUserPermissions();

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    printThermalReceipt(order, items, activeBusiness, order.changeDue || 0);
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
      <div style={styles.modalContent}>
        <div style={styles.receiptContainer}>
          <ReceiptPaper
            order={order}
            items={items}
            activeBusiness={activeBusiness}
            changeDue={order.changeDue || 0}
          />
        </div>

        {/* Receipt actions footer */}
        <div style={styles.receiptActions}>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button onClick={handlePrint} style={styles.printBtn} type="button">
              <Printer size={15} />
              <span>{t('history.printReceipt')}</span>
            </button>
            {order.status !== 'voided' && canPerform('delete', 'transactions') ? (
              <button
                onClick={handleVoidClick}
                disabled={voiding}
                style={styles.voidBtn}
                type="button"
              >
                <Ban size={15} />
                <span>{voiding ? t('common.loading') : t('history.refundButton')}</span>
              </button>
            ) : order.status === 'voided' ? (
              <button disabled style={styles.voidedBtn} type="button">
                <Ban size={15} />
                <span>Invoice Voided</span>
              </button>
            ) : null}
          </div>

          <button onClick={onClose} style={styles.receiptDoneBtn} type="button">
            {t('common.close')}
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
  voidBtn: {
    flex: 1,
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
  voidedBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
    border: '1px solid #e5e7eb',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    opacity: 0.6,
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
