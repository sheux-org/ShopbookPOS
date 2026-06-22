# Serial Mock — test thermal printing end-to-end, no hardware

Drives the web POS's **Web Serial thermal-printer path** with no physical printer,
no real serial port, and no Windows. It replaces `navigator.serial` in the page with a
mock that **captures the ESC/POS bytes** the app sends, forwards them to a small local
server, and **renders each as a receipt image** you can view in the browser.

Use it to verify the real app code path — connect, silent reconnect, print receipt,
cash-drawer kick, paper-width / drawer-pin settings — exactly as it would run against an
Xprinter XP-365B, but with the output rendered on screen instead of on paper.

```
 POS (localhost:3000)                         this tool
 ┌───────────────────────┐   write(bytes)   ┌──────────────────────────┐
 │ useThermalPrinter      │ ───────────────► │ inject.js (MAIN world)   │  mock navigator.serial
 │ webSerialPrinter.ts    │                  │  → window.__escpos        │  + window.postMessage
 │ thermalReceipt.tsx     │                  └────────────┬─────────────┘
 └───────────────────────┘                               │ postMessage
                                              ┌───────────▼─────────────┐
                                              │ relay.js (ISOLATED)      │  fetch POST /print
                                              └───────────┬─────────────┘
                                              ┌───────────▼─────────────┐
                                              │ server.mjs (:8930)       │  parse ESC/POS → HTML
                                              │  escpos-render.mjs       │  save .bin + .html
                                              └───────────┬─────────────┘
                                                          ▼
                                          http://localhost:8930  (live gallery)
                                          web/.preview/live/receipt-*.html
```

## 1. Start the render server

```bash
cd web
pnpm serial-mock            # or: node tools/serial-mock/server.mjs
```

Serves `http://localhost:8930`. Port override: `SERIAL_MOCK_PORT=9001 pnpm serial-mock`
(also update `SERVER` in `extension/relay.js`).

## 2. Load the extension

Chrome / Edge → `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select `web/tools/serial-mock/extension/`.

> The `--load-extension` command-line flag is **ignored by stable Chrome 137+**, so load it
> through the UI as above. Once loaded it auto-injects on `http://localhost:3000/*`.

You'll see `[serial-mock] navigator.serial mocked …` in the page console on load.

## 3. Print from the POS

Open `http://localhost:3000`, then either:

- **Profile → Thermal Printer Setup** → it auto-connects (silent reconnect via the mock) →
  **Print Test Receipt** / **Open Cash Drawer**, or
- complete a sale → **Receipt** → **Print** (the cash-drawer kick auto-fires on cash sales).

Each print appears at **`http://localhost:8930`** (auto-refreshing gallery) and is saved to
`web/.preview/live/receipt-<n>.html` and `.bin`. The gallery flags `💵 drawer` and `✂ cut`.

## Quick mode — no extension

For a one-off check without installing the extension, paste `extension/inject.js`'s body in
the DevTools console **before** clicking Connect, then read the captured bytes directly:

```js
window.__escpos.length; // bytes captured
window.__escpos.slice(0, 16); // first bytes (1b 40 = ESC @, etc.)
```

(Without the relay/server, bytes only accumulate on `window.__escpos`; no rendered image.)

## What it proves — and what it doesn't

- ✅ The full browser path: `requestPort` / `getPorts` / `open` / `writable.write`, silent
  reconnect, receipt bytes, drawer kick, and the paper-width / pin settings.
- ✅ The ESC/POS bytes are correct (rendered receipt + `ESC p` drawer detection). These match
  the offline `pnpm run print:preview` output byte-for-byte.
- ❌ Not the physical serial I/O handshake or actual paper output — only a real XP-365B confirms that.

## Files

| File                      | Role                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| `extension/manifest.json` | MV3; injects the two scripts on `localhost:3000`                  |
| `extension/inject.js`     | MAIN world: mock `navigator.serial`, capture bytes, `postMessage` |
| `extension/relay.js`      | ISOLATED world: forward bytes to the server (bypasses page CSP)   |
| `server.mjs`              | HTTP server: receive bytes, render, save, serve the gallery       |
| `escpos-render.mjs`       | Minimal ESC/POS → HTML parser/renderer (text subset the app uses) |

## Renderer scope

`escpos-render.mjs` handles the commands the POS emits: `ESC @` init, `ESC a` align,
`ESC E` / `ESC !` bold, `GS !` size, `GS B` reverse, `ESC d` feed, `LF`, `GS V` cut,
`ESC p` drawer kick, and UTF-8 text. The app's receipts are text-only (no raster/QR/barcode),
so this is faithful. For a true ESC/POS hardware-emulator render instead, feed a saved `.bin`
to `npx escpos-emulator` (see `web/docs/receipt-preview.md`).

## Troubleshooting

- **Gallery empty after printing** — is the server running? Relay failures log
  `[serial-mock] relay failed` in the page console.
- **Printer shows "not connected"** — the extension didn't inject; confirm it's loaded and the
  page is under `localhost:3000`. Reload the page after loading the extension.
- **Port 8930 in use** — set `SERIAL_MOCK_PORT` and update `relay.js`.
