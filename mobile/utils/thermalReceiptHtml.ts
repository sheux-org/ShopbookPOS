export type ThermalReceiptLineItem = {
  name: string;
  quantity: number;
  lineTotal: number;
};

export type BuildThermalReceiptOptions = {
  logoUri?: string | null;
  businessName: string;
  category: string;
  address: string;
  phone?: string | null;
  cashierLabel: string;
  paymentMethod?: string;
  invoiceLabel?: string;
  dateStr: string;
  status?: string;
  items: ThermalReceiptLineItem[];
  subtotal: number;
  tax: number;
  discount?: number;
  discountLabel?: string;
  taxLabel?: string;
  grandTotal: number;
  /** Shown as decorative footer line (digits from invoice work well). */
  barcodeLine?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildLogoHtml(logoUri?: string | null): string {
  if (!logoUri) {
    return `<div style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 8px; font-family: monospace; color: #000; letter-spacing: 2px;">★ SHOPBOOK POS ★</div>`;
  }
  if (logoUri.length <= 2) {
    return `<div style="font-size: 38px; text-align: center; margin-bottom: 5px;">${escapeHtml(logoUri)}</div>`;
  }
  const safeSrc = String(logoUri).replace(/"/g, '&quot;');
  return `<div style="text-align: center; margin-bottom: 5px;"><img src="${safeSrc}" style="width: 60px; height: 60px; border-radius: 30px; object-fit: cover;" /></div>`;
}

/**
 * HTML receipt matching POS thermal layout (Courier, dashed rules, narrow column).
 * Use with `expo-print` for system / AirPrint / many Bluetooth thermal drivers.
 */
export function buildThermalReceiptHtml(opts: BuildThermalReceiptOptions): string {
  const logoHtml = buildLogoHtml(opts.logoUri);
  const phone = (opts.phone ?? '').trim();

  const itemsHtml = opts.items
    .map(
      (item) => `
      <div class="flex-row">
        <span>${item.quantity}x ${escapeHtml(item.name)}</span>
        <span>Rs. ${item.lineTotal.toFixed(2)}</span>
      </div>
    `
    )
    .join('');

  const discountLabel = opts.discountLabel || 'Discount';
  const discountBlock =
    opts.discount && opts.discount > 0
      ? `
          <div class="flex-row">
            <span>${escapeHtml(discountLabel)}</span>
            <span>- Rs. ${opts.discount.toFixed(2)}</span>
          </div>`
      : '';

  const invoiceRow = opts.invoiceLabel
    ? `<div class="flex-row">
            <span>Invoice</span>
            <span>${escapeHtml(opts.invoiceLabel)}</span>
          </div>`
    : '';

  const paymentRow = opts.paymentMethod
    ? `<div class="flex-row">
            <span>Payment Method</span>
            <span>${escapeHtml(opts.paymentMethod)}</span>
          </div>`
    : '';

  const statusRow = opts.status
    ? `<div class="flex-row">
            <span>Status</span>
            <span>${escapeHtml(opts.status)}</span>
          </div>`
    : '';

  const barcode =
    opts.barcodeLine ??
    '|||| | ||||| | ||| ||||||| ' +
      (opts.invoiceLabel?.replace(/\D/g, '').slice(-7).padStart(7, '0') || '0000000');

  return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              padding: 10px;
              color: #000;
              font-size: 14px;
              max-width: 384px;
              margin: 0 auto;
            }
            .center { text-align: center; }
            .header-title { font-size: 18px; font-weight: bold; margin: 4px 0; }
            .separator { border-top: 1px dashed #000; margin: 10px 0; }
            .flex-row { display: flex; justify-content: space-between; margin: 4px 0; gap: 8px; }
            .flex-row span:first-child { flex: 1; min-width: 0; word-break: break-word; }
            .flex-row span:last-child { flex-shrink: 0; text-align: right; }
            .bold { font-weight: bold; }
            .barcode { font-size: 11px; text-align: center; margin-top: 15px; color: #555; }
          </style>
        </head>
        <body>
          ${logoHtml}
          <div class="center header-title">${escapeHtml(opts.businessName)}</div>
          <div class="center">${escapeHtml(opts.category)}</div>
          <div class="center">${escapeHtml(opts.address)}</div>
          ${phone ? `<div class="center">Tel: ${escapeHtml(phone)}</div>` : ''}

          <div class="separator"></div>

          <div class="flex-row">
            <span>Cashier</span>
            <span>${escapeHtml(opts.cashierLabel)}</span>
          </div>
          ${invoiceRow}
          <div class="flex-row">
            <span>Date</span>
            <span>${escapeHtml(opts.dateStr)}</span>
          </div>
          ${paymentRow}
          ${statusRow}

          <div class="separator"></div>

          ${itemsHtml}

          <div class="separator"></div>

          <div class="flex-row bold">
            <span>Subtotal</span>
            <span>Rs. ${opts.subtotal.toFixed(2)}</span>
          </div>
          <div class="flex-row">
            <span>${escapeHtml(opts.taxLabel || 'Standard Tax (8%)')}</span>
            <span>Rs. ${opts.tax.toFixed(2)}</span>
          </div>
          ${discountBlock}
          <div class="flex-row bold" style="font-size: 16px;">
            <span>TOTAL</span>
            <span>Rs. ${opts.grandTotal.toFixed(2)}</span>
          </div>

          <div class="separator"></div>
          <div class="center">Thank you for visiting!</div>
          <div class="center">Powered by Shopbook POS</div>
          <div class="barcode">${escapeHtml(barcode)}</div>
        </body>
      </html>
    `;
}
