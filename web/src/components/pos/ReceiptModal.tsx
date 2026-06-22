'use client';

import React from 'react';
import { Printer } from 'lucide-react';
import { ReceiptPaper, printThermalReceipt } from './ReceiptPaper';
import { useThermalPrinter } from '../../hooks/useThermalPrinter';
import { isUserCancellation } from '../../services/webSerialPrinter';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  icon?: string;
  sku?: string;
  maxStock?: number;
}

interface ReceiptModalProps {
  isOpen: boolean;
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
    cashReceived?: number;
    changeDue?: number;
    bankName?: string;
    cardLastFour?: string;
  } | null;
  items: CartItem[];
  activeBusiness: { name?: string; address?: string; phone?: string } | null;
  changeDue: number;
  onClose: () => void;
  posMode?: 'normal' | 'tablet';
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  order,
  items,
  activeBusiness,
  changeDue,
  onClose,
  posMode,
}) => {
  const thermal = useThermalPrinter();

  // Fallback: render the receipt through the OS print dialog (works everywhere).
  const systemPrint = () => {
    if (!order) return;
    printThermalReceipt(order, items, activeBusiness, changeDue);
  };

  // Smart print (explicit button press = has a user gesture, so we may prompt
  // the one-time device picker). Prefer a direct thermal printer; on cancel do
  // nothing; on any real failure fall back to the system print dialog.
  const handleSmartPrint = async () => {
    if (!order) return;
    if (thermal.supported) {
      try {
        await thermal.printReceipt({ order, items, activeBusiness, changeDue });
        return;
      } catch (err) {
        if (isUserCancellation(err)) return;
        console.warn('Thermal printer unavailable, using system print:', err);
      }
    }
    systemPrint();
  };

  // Auto-print on keyboard-optimized checkout. No user gesture here, so never
  // prompt: print directly only if a printer is already connected, else system.
  React.useEffect(() => {
    if (!isOpen || !order || posMode !== 'normal') return;
    if (thermal.supported && thermal.canPrint) {
      thermal.printReceipt({ order, items, activeBusiness, changeDue }).catch(() => systemPrint());
    } else {
      systemPrint();
    }
  }, [isOpen, order, posMode]);

  if (!isOpen || !order) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.receiptContainer}>
          <ReceiptPaper
            order={order}
            items={items}
            activeBusiness={activeBusiness}
            changeDue={changeDue}
          />
        </div>

        {/* Receipt actions footer */}
        <div style={styles.receiptActions}>
          <button onClick={handleSmartPrint} style={styles.printBtn}>
            <Printer size={15} />
            <span>Print Receipt</span>
          </button>

          {thermal.supported && (
            <span style={styles.printerHint}>
              {thermal.canPrint
                ? thermal.activeTransport === 'bridge'
                  ? '🖨 Print agent ready'
                  : '🖨 Thermal printer ready'
                : 'Tap to pick your printer (once), or prints via your system printer'}
            </span>
          )}

          <button onClick={onClose} style={styles.receiptDoneBtn}>
            Done & Clear Screen
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
  printerHint: {
    fontSize: '11px',
    color: 'var(--muted)',
    textAlign: 'center',
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
