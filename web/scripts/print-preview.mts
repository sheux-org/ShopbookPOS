/**
 * Receipt preview harness — hardware-free visual verification.
 *
 *   pnpm --filter web print:preview
 *
 * For each sale scenario, at BOTH printer profiles, this emits into web/.preview/:
 *   - <scenario>-<profile>.png   the real ESC/POS bytes rendered to an image
 *   - <scenario>-<profile>.bin   the exact bytes the app would send to the printer
 *   - <scenario>.html            the system-print HTML render
 *
 * Run it at both profiles every time the receipt changes: a layout that looks
 * right at 48 columns routinely breaks at 32. See docs/chittie-elements.md.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReceipt } from '@angadie/chittie-preview';
import { createCanvas, ImageData as NapiImageData } from '@napi-rs/canvas';
import { PRINTER_PROFILES } from '@angadie/chittie';
import {
  renderReceiptBytes,
  renderCashDrawerBytes,
  type PrinterProfile,
} from '../src/utils/thermalReceipt';
import { buildReceiptModel } from '../src/utils/receiptModel';
import { buildReceiptPrintHtml } from '../src/utils/receiptHtml';

// chittie-preview trims raster padding with `new ImageData(...)`, a browser global.
(globalThis as unknown as { ImageData: unknown }).ImageData ??= NapiImageData;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../.preview');

const PROFILES: PrinterProfile[] = ['58mm', '80mm'];

const business = { name: 'Artisan Haus', address: 'Kotte, Colombo', phone: '0765662423' };
const items = [
  { name: 'Flat White', price: 850, quantity: 2 },
  { name: 'Almond Croissant with salted caramel', price: 650, quantity: 1 },
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

    for (const profile of PROFILES) {
      const bytes = await renderReceiptBytes({
        ...base,
        profile,
        openCashDrawer: s.openCashDrawer,
      });
      const canvas = renderReceipt(bytes, {
        createCanvas,
        columns: PRINTER_PROFILES[profile].columns,
        // The pitch a printer falls back to when nothing sets one: 30 dots on a
        // 203-DPI TM printer, per Epson's ESC 3 reference. chittie-preview
        // defaults to 26, which would make a receipt that forgot to set its
        // pitch look shorter here than it prints.
        lineHeight: 30,
      });
      writeFileSync(resolve(OUT, `${s.name}-${profile}.bin`), bytes);
      writeFileSync(resolve(OUT, `${s.name}-${profile}.png`), canvas.toBuffer('image/png'));
      written.push(
        `${s.name}-${profile}.png  ${canvas.width}x${canvas.height}px  (${bytes.length}b)`
      );
    }

    writeFileSync(resolve(OUT, `${s.name}.html`), buildReceiptPrintHtml(buildReceiptModel(base)));
    written.push(`${s.name}.html`);
  }

  const drawer = await renderCashDrawerBytes();
  writeFileSync(resolve(OUT, 'drawer.bin'), drawer);
  written.push(`drawer.bin (${drawer.length}b)`);

  const cards = scenarios
    .flatMap((s) =>
      PROFILES.map(
        (p) =>
          `<figure><figcaption>${s.name} — ${p}</figcaption>` +
          `<img src="./${s.name}-${p}.png" alt="${s.name} ${p}"></figure>`
      )
    )
    .join('');
  writeFileSync(
    resolve(OUT, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Receipt previews</title>` +
      `<style>body{font:14px system-ui;background:#f4f4f5;padding:24px}` +
      `figure{display:inline-block;margin:0 16px 24px 0;vertical-align:top}` +
      `figcaption{margin-bottom:8px;font-weight:600}` +
      `img{background:#fff;border:1px solid #d4d4d8;box-shadow:0 1px 3px #0002}</style>` +
      `<h1>Receipt previews</h1>${cards}`
  );

  console.log(`Wrote ${written.length} artifacts to ${OUT}:`);
  written.forEach((w) => console.log('  - ' + w));
  console.log('\nOpen .preview/index.html to compare both profiles side by side.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
