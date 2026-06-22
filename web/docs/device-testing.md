# Device & Hardware Testing Guide

How to manually test the **POS device features** — login, barcode scanner, thermal
printer, and cash drawer — on your own machine, **with no physical hardware**. This is the
runbook for the flows that unit tests (`pnpm test`) can't cover end-to-end.

> Prereqs: app running locally (`pnpm dev:web`, see [getting_started.md](getting_started.md)).
> **Use Chrome or Edge** — Web Serial (printer) and `BarcodeDetector` (camera scan) do not
> exist in Safari/Firefox; the app feature-detects and shows a notice there.

---

## 1. Log in

The dev OTP is a fixed bypass (the login screen even hints it):

| Field | Value                                                                                        |
| ----- | -------------------------------------------------------------------------------------------- |
| Phone | any registered number — e.g. the shared demo tenant **`0717133074`** (store “YStore”, admin) |
| OTP   | **`11111`**                                                                                  |

A fresh number creates an empty tenant; the demo number has a seeded catalog to test against.

---

## 2. Barcode scanner

Two independent paths:

### a) USB scanner → adds to cart (`/pos`)

The hardware-scanner hook (`Scanner.tsx` `useHardwareScanner`) listens globally for the
fast keystrokes a USB/Bluetooth scanner emits (a burst <50 ms/key ending in Enter), then
looks the code up by `barcode` **or** `quickCode` and adds it to the cart.

No scanner? Simulate the burst in the DevTools console on `/pos` (a real product code):

```js
((code) => {
  for (const ch of code) window.dispatchEvent(new KeyboardEvent('keydown', { key: ch }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
})('2977835388819');
```

Expect a toast: `Added <product> 🛒`. Unknown code → `Barcode "…" not in catalog ⚠️`.
(Typing by hand won't work — too slow; the buffer resets above 50 ms between keys.)

### b) Camera scanner → fills the register-product form

Open **Stocks → register a product → scan**. Uses `BarcodeDetector` (Chrome/Edge only).
Point the webcam at a barcode/QR; the field fills. On Safari/Firefox it shows the
“use Chrome/Edge…” notice instead of a dead viewfinder.

### Generate scannable codes

`pnpm gen:barcodes` writes Code128 / EAN-13 / QR images to `web/.preview/barcodes/`
(open `index.html`) for products that have real barcodes. Edit the `PRODUCTS` list in
`scripts/gen-barcode.mjs` to encode other codes.

---

## 3. Thermal printer (ESC/POS) — four tiers, no printer needed for the first three

| Tier                            | What it tests                                                | How                                                                                                         |
| ------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Byte/visual preview**         | Receipt content + drawer kick bytes                          | `pnpm run print:preview` → see [receipt-preview.md](receipt-preview.md)                                     |
| **Live app path (recommended)** | The real browser Web Serial path rendered as a receipt image | the **serial-mock** dev tool → see [../tools/serial-mock/README.md](../tools/serial-mock/README.md)         |
| **Print agent — virtual mode**  | The bridge transport + a PNG render of the receipt           | run the agent with `PRINT_AGENT_VIRTUAL=1` → see [../../print-agent/README.md](../../print-agent/README.md) |
| **Real hardware**               | Physical print + paper output                                | Profile → Thermal Printer Setup → Connect → Print Test Receipt (XP-365B over a COM port)                    |

The **print-agent** (repo root `print-agent/`) is the production raw-print service AND a
no-hardware dev tool: `PRINT_AGENT_VIRTUAL=1` renders each `/print` to a PNG in
`shopbook-receipts/`. The app's bridge tier auto-detects it via `/health` — so a dev with
no printer runs the agent in virtual mode and gets PNG receipts from real checkouts.

### Live printer status + self-heal (what the cashier sees)

The Checkout Summary header shows a **printer-status pill**, driven by a live probe in
`useThermalPrinter` (polls `/health` + reacts to USB connect/disconnect + tab refocus —
not a one-shot check):

| Pill                  | Meaning                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| 🟢 `🖨 Printer ready` | a serial/COM printer is connected (Web Serial)                           |
| 🟢 `🖨 Agent ready`   | the print-agent is reachable (USB / queue printing)                      |
| 🟡 `🖨 System print`  | no direct printer — receipts use the OS print dialog. Click to re-check. |

**Test self-heal:** open the POS with the agent off → pill is amber `System print`. Start
the agent (`./print-agent/target/release/shopbook-print-agent`) → within ~6 s the pill
flips to green **without a reload** (covers the reboot race where the agent starts after
the POS). Unplug a serial printer → pill drops to amber on the disconnect event.

**Diagnostic on failure:** if a direct print fails, the receipt modal shows a plain note
("Couldn't reach the printer — opened the system print dialog instead. Check the
printer/cable or the print agent…") instead of silently switching — so the cashier knows
what happened and the one thing to check.

### USB auto-fallback (no app config)

The app posts only `{bytes}` to the agent. When the agent finds **no OS print queue**
(macOS/Linux with a USB printer-class device like the MJ5818), it **auto-routes to direct
USB** — so the same checkout prints on macOS with no app change. On Windows the installed
print queue stays primary. (To force USB explicitly, send `printer:"usb"`.)

The **serial-mock** tool is what reproduces our end-to-end automation: it mocks
`navigator.serial`, captures the ESC/POS bytes the app sends (test receipt, real sale,
drawer kick), and renders each as a receipt image at `http://localhost:8930`.

Once a real printer is granted once via **Connect Printer**, the app **auto-reconnects** on
every load (silent `getPorts()` reopen in `useThermalPrinter.ts`) — no re-picking. The grant
persists across reloads/restarts until revoked (`chrome://settings/content/serialPorts`),
site data cleared, or a different Chrome profile.

To switch from the mock back to a **live** printer: disable/remove the serial-mock extension,
reload, then **Connect Printer** and pick the real COM port. No app code changes — the app
always uses the real `navigator.serial`; only the dev extension overrides it.

---

## 4. Cash drawer

Wired into the printer's RJ11/RJ12 port; opens via an `ESC p` kick. It **auto-fires on cash
sales** when printing over Web Serial (`openDrawerOnCashSale`), and there's an on-demand
**Open Cash Drawer** button in Thermal Printer Setup. Verify the bytes with the serial-mock
tool (gallery flags `💵 drawer`) or `print:preview` (`xxd .preview/cash.bin | grep 1b70`).

---

## 5. Known gotchas

- **Chrome/Edge only** for Web Serial + camera scan; `localhost` counts as a secure context,
  so camera/serial work without HTTPS.
- **Pre-commit build clobbers the running dev server.** The husky hook runs `next build`
  (production) into the same `.next` the dev server serves → the page 404s its chunks and
  hangs on “Initializing POS Terminal…”. Fix: `pnpm dev:web:clean` (clears `.next` and
  restarts), or stop the dev server before committing.
- **Driving a real checkout creates a real synced order** in Supabase. Void it from Sales
  History if it was only a test.
