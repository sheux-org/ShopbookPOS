# Handoff — Shopbook POS Web: printing, scanning, cash drawer, device audit

**Scope of this handoff:** the WEB app (`web/`) device work done this session. The
`react-thermal-printer` fork effort (octalpixel/react-thermal-printer) is a **separate
track — not part of this handoff.**

**Status:** feature-complete and verified at the code level; **uncommitted**; **not yet
tested on physical hardware.**

---

## TL;DR for the next agent

This session added direct **thermal-printer** support to the web POS (Web Serial ESC/POS
with a system-print fallback), a **cash-drawer** kick, a **camera-scanner** fix, a **unified
receipt model** so preview == print, a **device-support audit**, and a **`print:preview`**
dev tool that renders receipts through an ESC/POS emulator without hardware.

Read these first (don't re-derive):

- `AUDIT-SUMMARY.md` — per-device verdict for the purchased ELITE POS kit + caveats.
- `shopbook-web-device-audit.csv` — the canonical per-feature audit (11 rows, all `retested-pass`).
- `web/docs/receipt-preview.md` — how to preview/verify receipts with the emulator.

## Verification already done (re-run before committing)

- `cd web && ../node_modules/.bin/tsc --noEmit` → clean
- `cd web && pnpm exec vitest run` → **195 passed**
- `cd web && pnpm exec next build` → clean
- `cd web && pnpm run print:preview` → emits `.bin`/`.html` to `web/.preview/`

## What changed (new + modified)

**New**

- `web/src/services/webSerialPrinter.ts` — Web Serial transport (connect / restore-silently /
  write / disconnect, `isWebSerialSupported`, `isUserCancellation`). Unit-tested.
- `web/src/utils/thermalReceipt.tsx` — JSX (react-thermal-printer) → ESC/POS `Uint8Array`;
  UTF-8 custom encoder; `<Cashdraw>` on cash; `renderCashDrawerBytes`, `renderTestReceiptBytes`.
- `web/src/utils/receiptModel.ts` — **single source of truth** (`buildReceiptModel`, `formatMoney`,
  `cleanInvoiceNumber`). Note: `discountValue` is the resolved **Rs amount**; `discountType:'percent'`
  only changes the label.
- `web/src/utils/receiptHtml.ts` — `buildReceiptPrintHtml(model)`; shared by browser system-print
  AND the preview tool.
- `web/src/hooks/useThermalPrinter.ts` — orchestration (supported/connected/connect/disconnect/
  printReceipt/printTestReceipt/openCashDrawer); auto-kick drawer on cash sales.
- `web/src/components/profile/ThermalPrinterModal.tsx` — connect/test/paper-width/baud/drawer-pin/
  open-drawer UI.
- `web/src/types/web-serial.d.ts` — minimal Web Serial ambient types.
- `web/scripts/print-preview.mts` — `pnpm run print:preview` dev tool.
- Tests: `web/src/__tests__/services/webSerialPrinter.test.ts`, `web/src/__tests__/utils/thermalReceipt.test.tsx`.
- `shopbook-web-device-audit.csv`, `AUDIT-SUMMARY.md`, `web/docs/receipt-preview.md`.

**Modified**

- `web/src/components/pos/ReceiptModal.tsx` — single smart **Print** button (silent reconnect →
  direct thermal → system fallback; aborts cleanly on picker cancel; normal-mode auto-print).
- `web/src/components/pos/ReceiptPaper.tsx` — colorful preview + `printThermalReceipt` now both
  source from `buildReceiptModel` / `buildReceiptPrintHtml` (re-exports `cleanInvoiceNumber`).
- `web/src/components/Scanner.tsx` — shows an "unsupported browser" notice when `BarcodeDetector`
  is absent instead of silently failing (audit row **F003**).
- `web/src/stores/settingsStore.ts` — `thermalPaperWidth`, `thermalBaudRate`, `cashDrawerPin`,
  `openDrawerOnCashSale`.
- `web/src/app/profile/page.tsx` — "Thermal Printer Setup" entry + modal.
- `web/next.config.js` — webpack `buffer` polyfill + `ProvidePlugin` (for bundled iconv-lite).
- `web/package.json`, `pnpm-lock.yaml` — deps below.
- `web/src/__tests__/components/Scanner.test.tsx` — updated to assert the new F003 behavior.

## Dependencies added (to `web`)

- `react-thermal-printer` (JSX→ESC/POS), `iconv-lite` (its undeclared runtime dep), `buffer`
  (browser polyfill iconv needs), `tsx` (devDep, for the preview script).
- `vite` (devDep) — **was a pre-existing missing peer of vitest**; the suite couldn't run from a
  clean install before. Independent of the printer feature.

## Open items / risks (READ — these are the real follow-ups)

1. **Nothing is committed.** Working tree holds everything. Commit in logical chunks
   (feature / audit / dev-tool) after re-running the 3 checks above.
2. **No physical-hardware test.** Verified only via tsc/tests/build + ESC/POS byte assertions +
   emulator. Must confirm on the real **XP-365B / cash drawer / scanner** (Chrome/Edge).
3. **XP-365B over USB on Windows likely enumerates as a _printer-class_ device, not a COM port** →
   Web Serial won't see it; the **system-print path** (install Xprinter driver, set default;
   optional Chrome `--kiosk-printing` for silent) is the realistic route on the POSMAX terminal.
   Confirm via Device Manager → Ports (COM & LPT). See `AUDIT-SUMMARY.md`.
4. **Cash drawer** opens only if wired to the printer's RJ11/RJ12 port; the `ESC p` kick fires on
   the **Web Serial** path. On the system-print path the drawer opens via the driver setting.
5. **Bundle size**: `/` and `/profile` first-load JS grew (~530–545 kB) from react-thermal-printer
   pulling `react-dom/server` + iconv-lite + buffer. Acceptable, but noted. (The fork track aims to
   eliminate this — out of scope here.)
6. **Sinhala/Tamil** receipts are **not** expressible via thermal code pages — they'd need raster/
   image text. English/LKR receipts are pure ASCII and fine.
7. Bluetooth thermal printing on **mobile** already exists in `mobile/` (unchanged this session).

## Suggested skills for the next session

- `/verify` — drive the app and confirm the change works (esp. once hardware is available).
- `/code-review` (or `/code-review ultra`) — review the uncommitted diff before committing.
- `/screens-audit-loop` — the device audit was produced under this skill; re-run to extend coverage
  or re-verify after fixes.
- `/verify` + the emulator workflow in `web/docs/receipt-preview.md` for receipt fidelity.

## Don't confuse with the other track

The `react-thermal-printer` **fork** (octalpixel/react-thermal-printer, in the sibling folder
`../react-thermal-printer`) is a separate, ongoing effort to make that library Web+RN/Expo-ready
with library-agnostic transports. **It is not part of this web-app handoff.**
