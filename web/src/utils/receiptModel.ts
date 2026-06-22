// Single source of truth for receipt content. The colorful HTML preview
// (ReceiptPaper), the ESC/POS thermal output (thermalReceipt), and the
// system-print HTML all derive their numbers/rows from buildReceiptModel so
// they can never drift. Each renderer keeps its own styling.

export interface ReceiptModelItem {
  name: string;
  quantity: number;
  lineTotal: number;
}

export interface ReceiptModelOrder {
  invoiceNumber: string;
  totalAmount: number | string;
  paymentMethod: string;
  discountValue: number | string;
  discountType?: string;
  taxValue: number | string;
  taxRate: number | string;
  dateStr: string;
  cashierName: string;
  status?: string;
  cashReceived?: number;
  bankName?: string;
  cardLastFour?: string;
}

export interface ReceiptModelInput {
  order: ReceiptModelOrder;
  items: { name: string; price: number; quantity: number }[];
  activeBusiness: { name?: string; address?: string; phone?: string } | null;
  changeDue: number;
}

export interface ReceiptModel {
  businessName: string;
  businessAddress: string;
  businessPhone: string | null;
  invoiceNumber: string;
  cashierName: string;
  date: string;
  time: string;
  status: string;
  isVoided: boolean;
  items: ReceiptModelItem[];
  subtotal: number;
  discount: { label: string; amount: number; netSubtotal: number } | null;
  tax: { label: string; amount: number } | null;
  total: number;
  paymentMethod: string;
  cashTendered: number | null;
  changeDue: number | null;
  cardLabel: string | null;
  bankName: string | null;
  footer: string[];
}

/** Strips the trailing "(Staff: …)" annotation stored on some invoice numbers. */
export function cleanInvoiceNumber(invoiceNumber: string): string {
  if (!invoiceNumber) return '';
  return invoiceNumber.split(' (Staff:')[0].trim();
}

export function formatMoney(n: number): string {
  return `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toNumber(v: number | string | undefined): number {
  const n = typeof v === 'number' ? v : parseFloat(v as string);
  return isNaN(n) ? 0 : n;
}

export function buildReceiptModel({
  order,
  items,
  activeBusiness,
  changeDue,
}: ReceiptModelInput): ReceiptModel {
  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const discountVal = toNumber(order.discountValue);
  const taxRateVal = toNumber(order.taxRate);
  const taxVal = toNumber(order.taxValue);
  const total = toNumber(order.totalAmount);

  const [datePart = '', timePart = ''] = (order.dateStr || '').split(' ');
  const status = (order.status || 'paid').toUpperCase();

  const discount =
    discountVal > 0
      ? {
          label:
            order.discountType === 'percent' && subtotal > 0
              ? `Discount (${Math.round((discountVal / subtotal) * 100)}%)`
              : 'Discount',
          amount: discountVal,
          netSubtotal: subtotal - discountVal,
        }
      : null;

  const tax =
    taxRateVal > 0 || taxVal > 0 ? { label: `VAT (${taxRateVal}%)`, amount: taxVal } : null;

  const method = order.paymentMethod;
  const cardLabel =
    method === 'card'
      ? `${order.bankName || ''}${order.cardLastFour ? ` (**** ${order.cardLastFour})` : ''}`.trim()
      : null;

  return {
    businessName: activeBusiness?.name?.trim() || 'Shopbook POS Partner',
    businessAddress: activeBusiness?.address?.trim() || 'Sri Lanka',
    businessPhone: activeBusiness?.phone?.trim() || null,
    invoiceNumber: cleanInvoiceNumber(order.invoiceNumber),
    cashierName: order.cashierName || '',
    date: datePart,
    time: timePart,
    status,
    isVoided: order.status === 'voided',
    items: items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      lineTotal: it.price * it.quantity,
    })),
    subtotal,
    discount,
    tax,
    total,
    paymentMethod: method,
    cashTendered: method === 'cash' ? (order.cashReceived ?? total) : null,
    changeDue: method === 'cash' ? changeDue : null,
    cardLabel,
    bankName: method === 'bank' ? order.bankName || '' : null,
    footer: ['THANK YOU, COME AGAIN!', 'Powered by Shopbook'],
  };
}
