import { JSDOM } from 'jsdom';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.preview', 'barcodes');
mkdirSync(outDir, { recursive: true });

// EAN-13: "29" store-internal prefix + 10 random + check digit (mirrors generateEAN13)
function generateEAN13() {
  const base = '29' + Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += i % 2 === 1 ? +base[i] * 3 : +base[i];
  return base + ((10 - (sum % 10)) % 10);
}

function barcodeSvg(value, format) {
  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, {
    format,
    xmlDocument: dom.window.document,
    width: 3,
    height: 120,
    fontSize: 22,
    margin: 20,
    displayValue: true,
    background: '#ffffff',
  });
  return new dom.window.XMLSerializer().serializeToString(svg);
}

// Real products from the YStore synced catalog (verified via live DB read).
const PRODUCTS = [
  { name: 'Iced Latte', code: '2977835388819', fmt: 'EAN13', price: 320 },
  { name: 'Ice Cream Sundae', code: '2930712559702', fmt: 'EAN13', price: 300 },
  { name: '✨ new buf', code: '8906075300019', fmt: 'EAN13', price: 699 },
];

const cards = PRODUCTS.map((p) => {
  let svg;
  try {
    svg = barcodeSvg(p.code, p.fmt);
  } catch {
    svg = barcodeSvg(p.code, 'CODE128'); // fall back if EAN-13 check digit is invalid
  }
  writeFileSync(`${outDir}/${p.code}.svg`, svg);
  return `<div class="card"><h2>${p.name} → ${p.code}</h2><p class="sub">Rs. ${p.price} · real catalog barcode</p>${svg}</div>`;
});

// QR encoding the Iced Latte barcode — easiest to scan off a screen.
await QRCode.toFile(`${outDir}/qr-iced-latte.png`, '2977835388819', { width: 320, margin: 2 });
cards.push(
  `<div class="card"><h2>QR → 2977835388819</h2><p class="sub">Iced Latte (easiest screen scan)</p><img src="qr-iced-latte.png" width="280" height="280"></div>`
);

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Scan test — real products</title>
<style>body{font-family:system-ui;text-align:center;padding:32px;background:#f8fafc}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:24px auto;max-width:560px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
h2{margin:0 0 4px}.sub{color:#64748b;font-size:13px;margin:0 0 16px}img,svg{max-width:100%}</style></head>
<body>${cards.join('\n')}</body></html>`;
writeFileSync(`${outDir}/index.html`, html);

console.log('Wrote real-product barcodes to:', outDir);
