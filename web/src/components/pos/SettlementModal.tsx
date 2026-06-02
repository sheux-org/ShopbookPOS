'use client';

import React from 'react';
import { X } from 'lucide-react';
import { SettlementCard } from './SettlementCard';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentMethod: 'cash' | 'card' | 'bank';
  handlePaymentMethodChange: (method: 'cash' | 'card' | 'bank') => void;
  cashReceived: string;
  setCashReceived: (val: string) => void;
  totalAmount: number;
  changeDue: number;
  isCustomBank: boolean;
  setIsCustomBank: (val: boolean) => void;
  bankName: string;
  setBankName: (val: string) => void;
  cardDigits: string;
  setCardDigits: (val: string) => void;
  paying: boolean;
  cartLength: number;
  isPaymentValid: boolean;
  handleConfirmCheckout: () => void;
  posMode: 'tablet' | 'normal';

  // Refs
  cashReceivedRef: React.RefObject<HTMLInputElement | null>;
  cardBrandSelectRef: React.RefObject<HTMLSelectElement | null>;
  cardDigitsRef: React.RefObject<HTMLInputElement | null>;
  bankNameSelectRef: React.RefObject<HTMLSelectElement | null>;
  bankNameRef: React.RefObject<HTMLInputElement | null>;
  settleBtnRef: React.RefObject<HTMLButtonElement | null>;
}

export const SettlementModal: React.FC<SettlementModalProps> = (props) => {
  if (!props.isOpen) return null;

  // Intercept confirm checkout to also trigger onClose
  const handleConfirm = () => {
    props.handleConfirmCheckout();
    props.onClose();
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>Settle Payment</h3>
          <button onClick={props.onClose} style={styles.modalCloseBtn}>
            <X size={16} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.invoiceTotalRow}>
            <span style={styles.invoiceTotalLabel}>Total Amount Due:</span>
            <span style={styles.invoiceTotalValue}>Rs. {props.totalAmount.toLocaleString()}</span>
          </div>
          <SettlementCard 
            {...props} 
            handleConfirmCheckout={handleConfirm}
          />
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
    width: '90%',
    maxWidth: '440px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  modalBody: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  invoiceTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    marginBottom: '4px',
  },
  invoiceTotalLabel: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  invoiceTotalValue: {
    fontSize: '18px',
    fontWeight: '800',
    color: 'var(--primary)',
  },
};
