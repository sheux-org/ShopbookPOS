'use client';

import React from 'react';

interface TotalsSummaryProps {
  subtotal: number;
  discountAmount: number;
  discountVal: number;
  discountType: 'none' | 'flat' | 'percent';
  taxAmount: number;
  taxRate: number;
  totalAmount: number;
  isEditingDiscount: boolean;
  setIsEditingDiscount: (val: boolean) => void;
  isEditingTax: boolean;
  setIsEditingTax: (val: boolean) => void;
  tempDiscount: string;
  setTempDiscount: (val: string) => void;
  tempDiscountType: 'flat' | 'percent';
  setTempDiscountType: (val: 'flat' | 'percent') => void;
  tempTaxRate: string;
  setTempTaxRate: (val: string) => void;
  handleSaveDiscount: () => void;
  handleSaveTax: () => void;
  discountInputRef: React.RefObject<HTMLInputElement | null>;
  taxInputRef: React.RefObject<HTMLInputElement | null>;
  posMode: 'tablet' | 'normal';
}

export const TotalsSummary: React.FC<TotalsSummaryProps> = ({
  subtotal,
  discountAmount,
  discountVal,
  discountType,
  taxAmount,
  taxRate,
  totalAmount,
  isEditingDiscount,
  setIsEditingDiscount,
  isEditingTax,
  setIsEditingTax,
  tempDiscount,
  setTempDiscount,
  tempDiscountType,
  setTempDiscountType,
  tempTaxRate,
  setTempTaxRate,
  handleSaveDiscount,
  handleSaveTax,
  discountInputRef,
  taxInputRef,
  posMode,
}) => {
  return (
    <div style={styles.denseSummaryCard}>
      <div style={styles.denseSumRow}>
        <span>Subtotal:</span>
        <span>Rs. {subtotal.toLocaleString()}</span>
      </div>

      <div style={styles.denseSumRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>Discount:</span>
          <button
            onClick={() => {
              setTempDiscount(discountVal.toString());
              setTempDiscountType(discountType === 'none' ? 'flat' : discountType);
              setIsEditingDiscount(true);
              setTimeout(() => discountInputRef.current?.focus(), 50);
            }}
            style={styles.inlineEditTextBtn}
          >
            Edit {posMode === 'normal' ? '[F6]' : ''}
          </button>
        </div>
        {isEditingDiscount ? (
          <div style={styles.inlineEditInputBox}>
            <select
              value={tempDiscountType}
              onChange={(e) => setTempDiscountType(e.target.value as 'flat' | 'percent')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  discountInputRef.current?.focus();
                }
              }}
              style={styles.inlineSelect}
            >
              <option value="flat">Rs</option>
              <option value="percent">%</option>
            </select>
            <input
              ref={discountInputRef}
              type="number"
              value={tempDiscount}
              onChange={(e) => setTempDiscount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveDiscount();
                } else if (e.key === '%' || e.key === 'p' || e.key === 'P') {
                  e.preventDefault();
                  setTempDiscountType('percent');
                } else if (e.key === '$' || e.key === 'r' || e.key === 'R') {
                  e.preventDefault();
                  setTempDiscountType('flat');
                }
              }}
              style={styles.inlineInput}
            />
            <button
              onClick={handleSaveDiscount}
              style={{ ...styles.inlineIconBtn, color: 'var(--success)' }}
            >
              ✓
            </button>
            <button
              onClick={() => setIsEditingDiscount(false)}
              style={{ ...styles.inlineIconBtn, color: 'var(--error)' }}
            >
              ✗
            </button>
          </div>
        ) : (
          <span style={discountAmount > 0 ? { color: 'var(--success)', fontWeight: 'bold' } : {}}>
            {discountAmount > 0 ? `- Rs. ${discountAmount.toLocaleString()}` : 'Rs. 0'}
          </span>
        )}
      </div>

      <div style={styles.denseSumRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>VAT / Taxes ({taxRate}%):</span>
          <button
            onClick={() => {
              setTempTaxRate(taxRate.toString());
              setIsEditingTax(true);
              setTimeout(() => taxInputRef.current?.focus(), 50);
            }}
            style={styles.inlineEditTextBtn}
          >
            Edit {posMode === 'normal' ? '[F7]' : ''}
          </button>
        </div>
        {isEditingTax ? (
          <div style={styles.inlineEditInputBox}>
            <input
              ref={taxInputRef}
              type="number"
              value={tempTaxRate}
              onChange={(e) => setTempTaxRate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTax();
              }}
              style={{ ...styles.inlineInput, width: '40px' }}
            />
            <span style={{ fontSize: '10px', margin: '0 2px' }}>%</span>
            <button
              onClick={handleSaveTax}
              style={{ ...styles.inlineIconBtn, color: 'var(--success)' }}
            >
              ✓
            </button>
            <button
              onClick={() => setIsEditingTax(false)}
              style={{ ...styles.inlineIconBtn, color: 'var(--error)' }}
            >
              ✗
            </button>
          </div>
        ) : (
          <span>Rs. {taxAmount.toLocaleString()}</span>
        )}
      </div>

      <div style={styles.denseSumDivider} />

      <div style={styles.denseSumTotalRow}>
        <span>TOTAL DUE:</span>
        <span>Rs. {totalAmount.toLocaleString()}</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  denseSummaryCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    boxShadow: 'var(--shadow)',
    marginBottom: '12px',
  },
  denseSumRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: 'var(--dark)',
  },
  inlineEditTextBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '10px',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: '4px',
    backgroundColor: 'var(--light-blue)',
    marginLeft: '2px',
  },
  inlineEditInputBox: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 4px',
    backgroundColor: 'var(--background)',
    height: '24px',
  },
  inlineSelect: {
    border: 'none',
    outline: 'none',
    fontSize: '10px',
    backgroundColor: 'transparent',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  inlineInput: {
    border: 'none',
    outline: 'none',
    width: '50px',
    fontSize: '11px',
    fontWeight: 'bold',
    textAlign: 'right',
    backgroundColor: 'transparent',
  },
  inlineIconBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '0 4px',
    fontWeight: 'bold',
  },
  denseSumDivider: {
    borderTop: '1px solid var(--border)',
    margin: '4px 0',
  },
  denseSumTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: '800',
    fontSize: '15px',
    color: 'var(--primary)',
  },
};
