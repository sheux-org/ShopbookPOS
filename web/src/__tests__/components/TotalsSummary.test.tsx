import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TotalsSummary } from '../../components/pos/TotalsSummary';

describe('TotalsSummary Component', () => {
  const defaultProps = {
    subtotal: 1000,
    discountAmount: 100,
    discountVal: 10,
    discountType: 'percent' as const,
    taxAmount: 72,
    taxRate: 8,
    totalAmount: 972,
    isEditingDiscount: false,
    setIsEditingDiscount: vi.fn(),
    isEditingTax: false,
    setIsEditingTax: vi.fn(),
    tempDiscount: '10',
    setTempDiscount: vi.fn(),
    tempDiscountType: 'percent' as const,
    setTempDiscountType: vi.fn(),
    tempTaxRate: '8',
    setTempTaxRate: vi.fn(),
    handleSaveDiscount: vi.fn(),
    handleSaveTax: vi.fn(),
    discountInputRef: React.createRef<HTMLInputElement>(),
    taxInputRef: React.createRef<HTMLInputElement>(),
    posMode: 'normal' as const,
  };

  test('should display subtotal, discount, tax, and total values correctly', () => {
    render(<TotalsSummary {...defaultProps} />);

    // Verify subtotal
    expect(screen.getByText('Subtotal:')).toBeInTheDocument();
    expect(screen.getByText('Rs. 1,000')).toBeInTheDocument();

    // Verify discount amount
    expect(screen.getByText('- Rs. 100')).toBeInTheDocument();

    // Verify tax amount and label
    expect(screen.getByText('VAT / Taxes (8%):')).toBeInTheDocument();
    expect(screen.getByText('Rs. 72')).toBeInTheDocument();

    // Verify total amount due
    expect(screen.getByText('TOTAL DUE:')).toBeInTheDocument();
    expect(screen.getByText('Rs. 972')).toBeInTheDocument();
  });

  test('should call edit state callbacks when edit buttons are clicked', () => {
    render(<TotalsSummary {...defaultProps} />);

    const editButtons = screen.getAllByText(/Edit/);
    expect(editButtons).toHaveLength(2); // One for discount, one for tax

    // Trigger edit discount
    fireEvent.click(editButtons[0]);
    expect(defaultProps.setIsEditingDiscount).toHaveBeenCalledWith(true);

    // Trigger edit tax
    fireEvent.click(editButtons[1]);
    expect(defaultProps.setIsEditingTax).toHaveBeenCalledWith(true);
  });

  test('should render inputs when editing states are active', () => {
    const editProps = {
      ...defaultProps,
      isEditingDiscount: true,
      isEditingTax: true,
    };

    render(<TotalsSummary {...editProps} />);

    // Verify select dropdown is shown
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // Verify discount input and tax inputs are shown
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2); // One for discount value, one for tax rate
  });
});
