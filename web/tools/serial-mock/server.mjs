// Receives ESC/POS byte payloads from the serial-mock browser extension,
// renders each as a receipt image (HTML), and serves a live gallery.
// No hardware, no Windows, no real serial port.

import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderEscposToHtml, parseEscpos } from './escpos-render.mjs';

const PORT = Number(process.env.SERIAL_MOCK_PORT) || 8930;
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../.preview/live');
mkdirSync(OUT_DIR, { recursive: true });

/** @type {{id:number,ts:string,bytes:number,drawerKick:boolean,cut:boolean,html:string}[]} */
const receipts = [];
let seq = 0;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
};

const indexPage = () => `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Serial Mock — captured receipts</title>
<meta http-equiv="refresh" content="2">
<style>
  body{font-family:system-ui;background:#f1f5f9;margin:0;padding:20px}
  h1{font-size:16px;margin:0 0 4px} .sub{color:#64748b;font-size:12px;margin:0 0 16px}
  .grid{display:flex;flex-wrap:wrap;gap:18px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05)}
  .meta{font-size:11px;color:#475569;padding:8px 10px;border-bottom:1px solid #eef2f7;display:flex;gap:10px;align-items:center}
  .kick{color:#0a7;font-weight:700} iframe{border:0;width:470px;height:560px;background:#e9edf2}
  .empty{color:#64748b;font-size:13px}
</style></head>
<body>
  <h1>🧾 Serial Mock — captured receipts</h1>
  <p class="sub">Auto-refreshes every 2s. Print from the POS (with the extension loaded) and receipts appear here. Saved to <code>web/.preview/live/</code>.</p>
  <div class="grid">
    ${
      receipts.length === 0
        ? `<p class="empty">No receipts captured yet. Load the extension, then Print Test Receipt or complete a sale.</p>`
        : receipts
            .slice()
            .reverse()
            .map(
              (r) => `<div class="card">
        <div class="meta"><b>#${r.id}</b><span>${r.ts}</span><span>${r.bytes}b</span>${
                r.drawerKick ? '<span class="kick">💵 drawer</span>' : ''
              }${r.cut ? '<span>✂ cut</span>' : ''}</div>
        <iframe src="/r/${r.id}"></iframe></div>`
            )
            .join('\n')
    }
  </div>
</body></html>`;

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  if (req.method === 'POST' && req.url === '/print') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        const { bytes } = JSON.parse(raw);
        const arr = Uint8Array.from(bytes);
        const id = ++seq;
        const ts = new Date().toLocaleTimeString();
        const { drawerKick, cut } = parseEscpos(arr);
        const html = renderEscposToHtml(arr, { title: `Receipt #${id}` });
        receipts.push({ id, ts, bytes: arr.length, drawerKick, cut, html });
        writeFileSync(resolve(OUT_DIR, `receipt-${id}.bin`), arr);
        writeFileSync(resolve(OUT_DIR, `receipt-${id}.html`), html);
        console.log(`[serial-mock] receipt #${id}: ${arr.length}b${drawerKick ? ' +drawer' : ''}${cut ? ' +cut' : ''} -> .preview/live/receipt-${id}.html`);
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id, bytes: arr.length, drawerKick, cut }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/r/')) {
    const id = Number(req.url.slice(3));
    const r = receipts.find((x) => x.id === id);
    if (!r) return res.writeHead(404).end('not found');
    return res.writeHead(200, { 'content-type': 'text/html' }).end(r.html);
  }

  if (req.method === 'GET' && req.url === '/health') {
    return res
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ ok: true, service: 'serial-mock', receipts: receipts.length }));
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    return res.writeHead(200, { 'content-type': 'text/html' }).end(indexPage());
  }

  res.writeHead(404).end('not found');
});

server.listen(PORT, () => {
  console.log(`\n  🧾 Serial-mock render server on http://localhost:${PORT}`);
  console.log(`  Open that URL, load the extension (see README), then print from the POS.\n`);
});
