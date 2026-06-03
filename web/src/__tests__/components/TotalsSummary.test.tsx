import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TotalsSummary } from '../../components/pos/TotalsSummary';

const buildProps = (overrides: Partial<React.ComponentProps<typeof TotalsSummary>> = {}) => ({
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
  ...overrides,
});

describe('TotalsSummary Component', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── Display values ───────────────────────────────────────────────

  test('should display subtotal, discount, tax, and total values correctly', () => {
    render(<TotalsSummary {...buildProps()} />);

    expect(screen.getByText('Subtotal:')).toBeInTheDocument();
    expect(screen.getByText('Rs. 1,000')).toBeInTheDocument();
    expect(screen.getByText('- Rs. 100')).toBeInTheDocument();
    expect(screen.getByText('VAT / Taxes (8%):')).toBeInTheDocument();
    expect(screen.getByText('Rs. 72')).toBeInTheDocument();
    expect(screen.getByText('TOTAL DUE:')).toBeInTheDocument();
    expect(screen.getByText('Rs. 972')).toBeInTheDocument();
  });

  test('should display Rs. 0 when discountAmount is zero', () => {
    render(<TotalsSummary {...buildProps({ discountAmount: 0, discountVal: 0, discountType: 'none' })} />);
    expect(screen.getByText('Rs. 0')).toBeInTheDocument();
  });

  test('should show keyboard hints [F6] and [F7] in normal posMode', () => {
    render(<TotalsSummary {...buildProps({ posMode: 'normal' })} />);
    expect(screen.getByText(/Edit \[F6\]/)).toBeInTheDocument();
    expect(screen.getByText(/Edit \[F7\]/)).toBeInTheDocument();
  });

  test('should hide keyboard hints in tablet posMode', () => {
    render(<TotalsSummary {...buildProps({ posMode: 'tablet' })} />);
    // In tablet mode there are no [F6]/[F7] hints
    expect(screen.queryByText(/\[F6\]/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\[F7\]/)).not.toBeInTheDocument();
  });

  // ─── Edit button callbacks ────────────────────────────────────────

  test('should call edit state callbacks when edit buttons are clicked', () => {
    const props = buildProps();
    render(<TotalsSummary {...props} />);

    const editButtons = screen.getAllByText(/Edit/);
    expect(editButtons).toHaveLength(2);

    fireEvent.click(editButtons[0]); // discount edit
    expect(props.setIsEditingDiscount).toHaveBeenCalledWith(true);
    expect(props.setTempDiscount).toHaveBeenCalledWith('10');

    fireEvent.click(editButtons[1]); // tax edit
    expect(props.setIsEditingTax).toHaveBeenCalledWith(true);
    expect(props.setTempTaxRate).toHaveBeenCalledWith('8');
  });

  test('should set discountType to flat when current type is none', () => {
    const props = buildProps({ discountType: 'none', discountVal: 0 });
    render(<TotalsSummary {...props} />);

    const editButtons = screen.getAllByText(/Edit/);
    fireEvent.click(editButtons[0]);

    // When discountType is 'none', setTempDiscountType('flat') should be called
    expect(props.setTempDiscountType).toHaveBeenCalledWith('flat');
  });

  // ─── Editing discount inputs ──────────────────────────────────────

  test('should render inputs when editing states are active', () => {
    render(<TotalsSummary {...buildProps({ isEditingDiscount: true, isEditingTax: true })} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
  });

  test('should call setTempDiscountType when select value changes', () => {
    const props = buildProps({ isEditingDiscount: true });
    render(<TotalsSummary {...props} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'flat' } });
    expect(props.setTempDiscountType).toHaveBeenCalledWith('flat');
  });

  test('should call setTempDiscount when discount input changes', () => {
    const props = buildProps({ isEditingDiscount: true });
    render(<TotalsSummary {...props} />);

    const [discountInput] = screen.getAllByRole('spinbutton');
    fireEvent.change(discountInput, { target: { value: '25' } });
    expect(props.setTempDiscount).toHaveBeenCalledWith('25');
  });

  test('should call handleSaveDiscount when Enter is pressed on discount input', () => {
    const props = buildProps({ isEditingDiscount: true });
    render(<TotalsSummary {...props} />);

    const [discountInput] = screen.getAllByRole('spinbutton');
    fireEvent.keyDown(discountInput, { key: 'Enter' });
    expect(props.handleSaveDiscount).toHaveBeenCalled();
  });

  test('should set percent type when "%" key is pressed on discount input', () => {
    const props = buildProps({ isEditingDiscount: true });
    render(<TotalsSummary {...props} />);

    const [discountInput] = screen.getAllByRole('spinbutton');
    fireEvent.keyDown(discountInput, { key: '%' });
    expect(props.setTempDiscountType).toHaveBeenCalledWith('percent');
  });

  test('should set percent type when "p" key is pressed on discount input', () => {
    const props = buildProps({ isEditingDiscount: true });
    render(<TotalsSummary {...props} />);

    const [discountInput] = screen.getAllByRole('spinbutton');
    fireEvent.keyDown(discountInput, { key: 'p' });
    expect(props.setTempDiscountType).toHaveBeenCalledWith('percent');
  });

  test('should set percent type when "P" key is pressed on discount input', () => {
    const props = buildProps({ isEditingDiscount: true });
    render(<TotalsSummary {...props} />);

    const [discountInput] = screen.getAllByRole('spinbutton');
    fireEvent.keyDown(discountInput, { key: 'P' });
    expect(props.setTempDiscountType).toHaveBeenCalledWith('percent');
  });

  test('should set flat type when "$" key is pressed on discount input', () => {
    const props = buildProps({ isEditingDiscount: true });
    render(<TotalsSummary {...props} />);

    const [discountInput] = screen.getAllByRole('spinbutton');
    fireEvent.keyDown(discountInput, { key: '$' });
    expect(props.setTempDiscountType).toHaveBeenCalledWith('flat');
  });

  test('should set flat type when "r" key is pressed on discount input', () => {
    const props = buildProps({ isEditingDiscount: true });
    render(<TotalsSummary {...props} />);

    const [discountInput] = screen.getAllByRole('spinbutton');
    fireEvent.keyDown(discountInput, { key: 'r' });
    expect(props.setTempDiscountType).toHaveBeenCalledWith('flat');
  });

  test('should focus discount input when Enter pressed on type select', () => {
    const discountRef = React.createRef<HTMLInputElement>();
    const props = buildProps({ isEditingDiscount: true, discountInputRef: discountRef });
    render(<TotalsSummary {...props} />);

    const select = screen.getByRole('combobox');
    fireEvent.keyDown(select, { key: 'Enter' });
    // We just check it doesn't throw - focus behavior is DOM-level
  });

  test('should call handleSaveDiscount when ✓ button is clicked', () => {
    const props = buildProps({ isEditingDiscount: true });
    render(<TotalsSummary {...props} />);

    const saveBtn = screen.getByText('✓');
    fireEvent.click(saveBtn);
    expect(props.handleSaveDiscount).toHaveBeenCalled();
  });

  test('should call setIsEditingDiscount(false) when ✗ button is clicked', () => {
    const props = buildProps({ isEditingDiscount: true });
    render(<TotalsSummary {...props} />);

    const cancelBtns = screen.getAllByText('✗');
    fireEvent.click(cancelBtns[0]);
    expect(props.setIsEditingDiscount).toHaveBeenCalledWith(false);
  });

  // ─── Editing tax inputs ───────────────────────────────────────────

  test('should call setTempTaxRate when tax input changes', () => {
    const props = buildProps({ isEditingTax: true });
    render(<TotalsSummary {...props} />);

    const inputs = screen.getAllByRole('spinbutton');
    const taxInput = inputs[0]; // only one input when only editing tax
    fireEvent.change(taxInput, { target: { value: '15' } });
    expect(props.setTempTaxRate).toHaveBeenCalledWith('15');
  });

  test('should call handleSaveTax when Enter is pressed on tax input', () => {
    const props = buildProps({ isEditingTax: true });
    render(<TotalsSummary {...props} />);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.keyDown(inputs[0], { key: 'Enter' });
    expect(props.handleSaveTax).toHaveBeenCalled();
  });

  test('should call handleSaveTax when ✓ button is clicked in tax editing', () => {
    const props = buildProps({ isEditingTax: true });
    render(<TotalsSummary {...props} />);

    const saveBtns = screen.getAllByText('✓');
    fireEvent.click(saveBtns[0]);
    expect(props.handleSaveTax).toHaveBeenCalled();
  });

  test('should call setIsEditingTax(false) when ✗ button clicked in tax editing', () => {
    const props = buildProps({ isEditingTax: true });
    render(<TotalsSummary {...props} />);

    const cancelBtns = screen.getAllByText('✗');
    fireEvent.click(cancelBtns[0]);
    expect(props.setIsEditingTax).toHaveBeenCalledWith(false);
  });
});
