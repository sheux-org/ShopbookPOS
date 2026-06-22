/**
 * Receipt preview / emulator harness.
 *
 *   pnpm run print:preview
 *
 * Emits, for several sale scenarios, the EXACT bytes the app would send to a
 * thermal printer (.bin) plus a savable HTML render (.html) into web/.preview/.
 * Then either:
 *   - open the .html files in a browser and "Save as PDF", or
 *   - feed the .bin to a local ESC/POS emulator to see a live render:
 *       npx escpos-emulator                         # preview at http://localhost:3000
 *       cat .preview/cash.bin | nc -w1 localhost 9100
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReceiptBytes, renderCashDrawerBytes } from '../src/utils/thermalReceipt';
import { buildReceiptModel } from '../src/utils/receiptModel';
import { buildReceiptPrintHtml } from '../src/utils/receiptHtml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../.preview');

const business = { name: 'Artisan Haus', address: 'Kotte, Colombo', phone: '0765662423' };
const items = [
  { name: 'Flat White', price: 850, quantity: 2 },
  { name: 'Almond Croissant', price: 650, quantity: 1 },
];

type Scenario = {
  name: string;
  order: Parameters<typeof buildReceiptModel>[0]['order'];
  changeDue: number;
  openCashDrawer?: boolean;
};

const scenarios: Scenario[] = [
  {
    name: 'cash',
    order: {
      invoiceNumber: 'INV-100428',
      totalAmount: 2350,
      paymentMethod: 'cash',
      discountValue: 0,
      taxValue: 0,
      taxRate: 0,
      dateStr: '2026-06-22 17:30',
      cashierName: 'Visham',
      status: 'paid',
      cashReceived: 3000,
    },
    changeDue: 650,
    openCashDrawer: true,
  },
  {
    name: 'card',
    order: {
      invoiceNumber: 'INV-100429',
      totalAmount: 2350,
      paymentMethod: 'card',
      discountValue: 0,
      taxValue: 0,
      taxRate: 0,
      dateStr: '2026-06-22 17:31',
      cashierName: 'Visham',
      status: 'paid',
      bankName: 'Sampath',
      cardLastFour: '4242',
    },
    changeDue: 0,
  },
  {
    name: 'discount-vat',
    order: {
      invoiceNumber: 'INV-100430',
      totalAmount: 2284.2, // 2350 - 235 (10%) + 169.20 VAT
      paymentMethod: 'cash',
      discountValue: 235, // resolved Rs amount of a 10% discount on 2350
      discountType: 'percent',
      taxValue: 169.2,
      taxRate: 8,
      dateStr: '2026-06-22 17:32',
      cashierName: 'Visham',
      status: 'paid',
      cashReceived: 2500,
    },
    changeDue: 215.8,
    openCashDrawer: true,
  },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const written: string[] = [];

  for (const s of scenarios) {
    const base = { order: s.order, items, activeBusiness: business, changeDue: s.changeDue };
    const bytes = await renderReceiptBytes({
      ...base,
      widthChars: 48,
      openCashDrawer: s.openCashDrawer,
      cashDrawerPin: '2pin',
    });
    const html = buildReceiptPrintHtml(buildReceiptModel(base));
    writeFileSync(resolve(OUT, `${s.name}.bin`), bytes);
    writeFileSync(resolve(OUT, `${s.name}.html`), html);
    written.push(`${s.name}.bin (${bytes.length}b)  ${s.name}.html`);
  }

  const drawer = await renderCashDrawerBytes('2pin');
  writeFileSync(resolve(OUT, 'drawer.bin'), drawer);
  written.push(`drawer.bin (${drawer.length}b)`);

  const links = scenarios
    .map((s) => `<li><a href="./${s.name}.html" target="_blank">${s.name}</a></li>`)
    .join('');
  writeFileSync(
    resolve(OUT, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Receipt previews</title>` +
      `<h1>Receipt previews</h1><ul>${links}</ul>` +
      `<p>Open one and use your browser's "Save as PDF". For a true ESC/POS render, run ` +
      `<code>npx escpos-emulator</code> then <code>cat .preview/&lt;name&gt;.bin | nc -w1 localhost 9100</code>.</p>`
  );

  console.log(`Wrote ${written.length} artifacts to ${OUT}:`);
  written.forEach((w) => console.log('  - ' + w));
  console.log('\nOpen .preview/index.html in a browser, or feed a .bin to npx escpos-emulator.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
