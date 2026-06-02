'use client';

import React from 'react';
import { Banknote, CreditCard, Wallet, AlertTriangle, CheckCircle, Printer } from 'lucide-react';

interface SettlementCardProps {
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

const CARD_BRANDS_AND_BANKS = [
  'Visa - Commercial Bank',
  'Visa - Sampath Bank',
  'Visa - HNB',
  'MasterCard - Commercial Bank',
  'MasterCard - Sampath Bank',
  'Amex - Nations Trust Bank',
  'JCB - HNB'
];

const SRI_LANKAN_BANKS = [
  'Commercial Bank of Ceylon',
  'Sampath Bank',
  'Hatton National Bank (HNB)',
  'Bank of Ceylon (BOC)',
  'People\'s Bank',
  'Nations Trust Bank (NTB)',
  'DFCC Bank',
  'NDB Bank'
];

export const SettlementCard: React.FC<SettlementCardProps> = ({
  paymentMethod,
  handlePaymentMethodChange,
  cashReceived,
  setCashReceived,
  totalAmount,
  changeDue,
  isCustomBank,
  setIsCustomBank,
  bankName,
  setBankName,
  cardDigits,
  setCardDigits,
  paying,
  cartLength,
  isPaymentValid,
  handleConfirmCheckout,
  posMode,
  cashReceivedRef,
  cardBrandSelectRef,
  cardDigitsRef,
  bankNameSelectRef,
  bankNameRef,
  settleBtnRef,
}) => {
  return (
    <>
      <div style={styles.paymentSectionCard}>
        {/* Payment Method Selector */}
        <div>
          <label style={styles.denseFieldLabel}>Payment Mode {posMode === 'normal' ? '[F4]' : ''}</label>
          <div style={styles.payOptionRow}>
            <button
              onClick={() => handlePaymentMethodChange('cash')}
              style={{
                ...styles.payOptionBtn,
                ...(paymentMethod === 'cash' ? styles.payOptionBtnCashActive : {})
              }}
            >
              <Banknote size={16} />
              <span>Cash</span>
            </button>
            <button
              onClick={() => handlePaymentMethodChange('card')}
              style={{
                ...styles.payOptionBtn,
                ...(paymentMethod === 'card' ? styles.payOptionBtnCardActive : {})
              }}
            >
              <CreditCard size={16} />
              <span>Card</span>
            </button>
            <button
              onClick={() => handlePaymentMethodChange('bank')}
              style={{
                ...styles.payOptionBtn,
                ...(paymentMethod === 'bank' ? styles.payOptionBtnBankActive : {})
              }}
            >
              <Wallet size={16} />
              <span>Bank</span>
            </button>
          </div>
        </div>

        {/* Tender Amount inputs details area */}
        <div style={styles.tenderTogglesArea}>
          {paymentMethod === 'cash' && (
            <div>
              <label style={styles.denseFieldLabel}>Cash Tendered (Rs.) {posMode === 'normal' ? '[F8]' : ''}</label>
              <input
                ref={cashReceivedRef}
                type="number"
                placeholder="Enter cash received..."
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                style={styles.denseTenderInput}
              />

              {/* Cash chips selector */}
              <div style={styles.fastTenderGrid}>
                <button onClick={() => setCashReceived(Math.ceil(totalAmount).toString())} style={styles.fastTenderChip}>
                  Exact
                </button>
                {[100, 200, 500, 1000, 5000].map(note => {
                  if (note < totalAmount) return null;
                  return (
                    <button key={note} onClick={() => setCashReceived(note.toString())} style={styles.fastTenderChip}>
                      Rs. {note}
                    </button>
                  );
                })}
              </div>

              {cashReceived !== '' && (
                parseFloat(cashReceived) < totalAmount ? (
                  <div style={styles.tenderWarningBanner}>
                    <AlertTriangle size={14} />
                    <span>Short by Rs. {(totalAmount - (parseFloat(cashReceived) || 0)).toLocaleString()}</span>
                  </div>
                ) : null
              )}
            </div>
          )}

          {paymentMethod === 'card' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={styles.denseFieldLabel}>Card Brand / Bank *</label>
                <select
                  ref={cardBrandSelectRef}
                  value={isCustomBank ? 'Other' : bankName}
                  onChange={(e) => {
                    if (e.target.value === 'Other') {
                      setIsCustomBank(true);
                      setBankName('');
                    } else {
                      setIsCustomBank(false);
                      setBankName(e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (e.currentTarget.value === 'Other') {
                        bankNameRef.current?.focus();
                      } else {
                        cardDigitsRef.current?.focus();
                      }
                    }
                  }}
                  style={styles.denseTenderSelect}
                >
                  <option value="">Select Card brand/bank...</option>
                  {CARD_BRANDS_AND_BANKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="Other">Other Bank (Type...)</option>
                </select>

                {isCustomBank && (
                  <input
                    ref={bankNameRef}
                    type="text"
                    placeholder="Type custom card bank..."
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    style={{ ...styles.denseTenderInput, marginTop: '6px' }}
                  />
                )}
              </div>
              <div>
                <label style={styles.denseFieldLabel}>Card Number (Last 4 Digits) * {posMode === 'normal' ? '[F8]' : ''}</label>
                <input
                  ref={cardDigitsRef}
                  type="text"
                  maxLength={4}
                  placeholder="e.g. 9876"
                  value={cardDigits}
                  onChange={(e) => {
                    const numericVal = e.target.value.replace(/[^0-9]/g, "");
                    setCardDigits(numericVal.slice(0, 4));
                  }}
                  style={styles.denseTenderInput}
                />
              </div>
            </div>
          )}

          {paymentMethod === 'bank' && (
            <div>
              <label style={styles.denseFieldLabel}>Beneficiary Bank Name * {posMode === 'normal' ? '[F8]' : ''}</label>
              <select
                ref={bankNameSelectRef}
                value={isCustomBank ? 'Other' : bankName}
                onChange={(e) => {
                  if (e.target.value === 'Other') {
                    setIsCustomBank(true);
                    setBankName('');
                  } else {
                    setIsCustomBank(false);
                    setBankName(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.currentTarget.value === 'Other') {
                      bankNameRef.current?.focus();
                    } else {
                      settleBtnRef.current?.focus();
                    }
                  }
                }}
                style={styles.denseTenderSelect}
              >
                <option value="">Select Beneficiary Bank...</option>
                {SRI_LANKAN_BANKS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
                <option value="Other">Other Bank (Type...)</option>
              </select>

              {isCustomBank && (
                <input
                  ref={bankNameRef}
                  type="text"
                  placeholder="Type bank name..."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  style={{ ...styles.denseTenderInput, marginTop: '6px' }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {paymentMethod === 'cash' && cashReceived !== '' && parseFloat(cashReceived) >= totalAmount && (
        <div style={styles.largeBalanceCard}>
          <span style={styles.largeBalanceLabel}>Change / Balance to Return</span>
          <span style={styles.largeBalanceValue}>Rs. {changeDue.toLocaleString()}</span>
        </div>
      )}

      {/* Settle confirm checkout payment button */}
      <button
        ref={settleBtnRef}
        onClick={handleConfirmCheckout}
        disabled={paying || cartLength === 0 || !isPaymentValid}
        style={{
          ...styles.settleInvoiceBtn,
          ...((cartLength === 0 || !isPaymentValid) ? styles.settleInvoiceBtnDisabled : {})
        }}
      >
        <Printer size={16} />
        <span>Confirm & Print Receipt {posMode === 'normal' ? '[F10]' : ''}</span>
      </button>
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  paymentSectionCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: 'var(--shadow)',
    marginBottom: '12px',
  },
  denseFieldLabel: {
    display: 'block',
    fontSize: '10px',
    fontWeight: 'bold',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  payOptionRow: {
    display: 'flex',
    gap: '8px',
  },
  payOptionBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  },
  payOptionBtnCashActive: {
    backgroundColor: '#eff6ff',
    border: '1px solid #3b82f6',
    color: '#2563eb',
  },
  payOptionBtnCardActive: {
    backgroundColor: '#faf5ff',
    border: '1px solid #a855f7',
    color: '#7e22ce',
  },
  payOptionBtnBankActive: {
    backgroundColor: '#ecfdf5',
    border: '1px solid #10b981',
    color: '#047857',
  },
  tenderTogglesArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  denseTenderInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
    boxSizing: 'border-box',
  },
  denseTenderSelect: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    fontSize: '13px',
    outline: 'none',
    backgroundColor: 'var(--background)',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  fastTenderGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '8px',
  },
  fastTenderChip: {
    padding: '6px 12px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    fontSize: '11px',
    color: 'var(--dark)',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  tenderWarningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#fff1f2',
    color: 'var(--error)',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    marginTop: '10px',
  },
  tenderSuccessBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#ecfdf5',
    color: 'var(--success)',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    marginTop: '10px',
  },
  settleInvoiceBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
  },
  settleInvoiceBtnDisabled: {
    backgroundColor: '#cbd5e1',
    color: '#94a3b8',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  largeBalanceCard: {
    backgroundColor: '#f0fdf4',
    border: '2px solid #bbf7d0',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    boxShadow: '0 2px 8px rgba(22, 163, 74, 0.05)',
  },
  largeBalanceLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  largeBalanceValue: {
    fontSize: '28px',
    fontWeight: '900',
    color: '#16A34A',
  },
};
