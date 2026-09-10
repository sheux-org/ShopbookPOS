import { formatMoney, type ReceiptModel } from './receiptModel';

// Pure (no DOM) builder for the 80mm print/preview HTML. Used by the browser
// system-print path AND the offline preview tool, so they can't drift.
export function buildReceiptPrintHtml(m: ReceiptModel): string {
  return `
      <html>
        <head>
          <title>Invoice Receipt ${m.invoiceNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
            body {
              margin: 0;
              padding: 10px;
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              color: #000000;
              width: 76mm; /* typical thermal size */
            }
            .receipt-header {
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 4px;
            }
            .receipt-store-name {
              font-size: 16px;
              font-weight: bold;
              margin: 0;
              text-transform: uppercase;
            }
            .receipt-store-address, .receipt-store-phone {
              margin: 2px 0;
              font-size: 11px;
            }
            .receipt-divider {
              border-top: 1px dashed #000000;
              margin: 8px 0;
            }
            .receipt-meta {
              display: flex;
              flex-direction: column;
              gap: 3px;
              font-size: 11px;
            }
            .receipt-meta-row {
              display: flex;
              justify-content: space-between;
            }
            .receipt-items-list {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .receipt-item-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .receipt-totals {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .receipt-totals-row {
              display: flex;
              justify-content: space-between;
            }
            .receipt-footer {
              text-align: center;
              margin-top: 15px;
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <h3 class="receipt-store-name">${m.businessName}</h3>
            <p class="receipt-store-address">${m.businessAddress}</p>
            <p class="receipt-store-phone">${m.businessPhone || '+94 ** *** ****'}</p>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-meta">
            <div class="receipt-meta-row">
              <span><strong>Invoice:</strong> ${m.invoiceNumber}</span>
              <span><strong>Date:</strong> ${m.date} ${m.time}</span>
            </div>
            ${
              m.notableStatus
                ? `<div class="receipt-meta-row">
              <span><strong>Status:</strong> ${m.notableStatus}</span>
            </div>`
                : ''
            }
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-items-list">
            <div class="receipt-item-row" style="font-weight: bold; border-bottom: 1px dashed #000000; padding-bottom: 3px; margin-bottom: 3px;">
              <span style="flex: 2.5;">Item Description</span>
              <span style="flex: 0.8; text-align: center;">Qty</span>
              <span style="flex: 1.2; text-align: right;">Amount</span>
            </div>
            ${m.items
              .map(
                (item) => `
              <div class="receipt-item-row">
                <span style="flex: 2.5; word-wrap: break-word;">${item.name}</span>
                <span style="flex: 0.8; text-align: center;">${item.quantity}</span>
                <span style="flex: 1.2; text-align: right;">${formatMoney(item.lineTotal)}</span>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-totals">
            <div class="receipt-totals-row">
              <span>Sub Total</span>
              <span>${formatMoney(m.subtotal)}</span>
            </div>
            ${
              m.discount
                ? `
              <div class="receipt-totals-row">
                <span>${m.discount.label}</span>
                <span>- ${formatMoney(m.discount.amount)}</span>
              </div>
              <div class="receipt-totals-row">
                <span>Net Subtotal</span>
                <span>${formatMoney(m.discount.netSubtotal)}</span>
              </div>
            `
                : ''
            }
            ${
              m.tax
                ? `
              <div class="receipt-totals-row">
                <span>${m.tax.label}</span>
                <span>${formatMoney(m.tax.amount)}</span>
              </div>
            `
                : ''
            }
            <div class="receipt-divider" style="margin: 4px 0;"></div>
            <div class="receipt-totals-row" style="font-weight: bold; font-size: 13px;">
              <span>NET TOTAL</span>
              <span>${formatMoney(m.total)}</span>
            </div>
            <div class="receipt-divider" style="margin: 4px 0;"></div>
            <div class="receipt-totals-row">
              <span>Payment Mode</span>
              <span style="text-transform: uppercase;">${m.paymentMethod}</span>
            </div>
            ${
              m.cashTendered !== null
                ? `
              <div class="receipt-totals-row">
                <span>Cash Tendered</span>
                <span>${formatMoney(m.cashTendered)}</span>
              </div>
              <div class="receipt-totals-row" style="font-weight: bold;">
                <span>Change Due</span>
                <span>${formatMoney(m.changeDue ?? 0)}</span>
              </div>
            `
                : ''
            }
            ${
              m.cardLabel
                ? `
              <div class="receipt-totals-row">
                <span>Card / Bank</span>
                <span>${m.cardLabel}</span>
              </div>
            `
                : ''
            }
            ${
              m.bankName
                ? `
              <div class="receipt-totals-row">
                <span>Bank Name</span>
                <span>${m.bankName}</span>
              </div>
            `
                : ''
            }
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-footer">
            <p style="font-weight: bold; margin: 4px 0; font-size: 12px; letter-spacing: 0.5px;">${m.footer[0]}</p>
            <p style="margin: 4px 0; font-size: 10px; color: #555555;">${m.footer[1]}</p>
          </div>
        </body>
      </html>
    `;
}
