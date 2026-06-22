# Receipt Preview & ESC/POS Emulator

Verify thermal receipts (and the cash-drawer kick) **without a physical printer**.

## Generate previews

```bash
pnpm run print:preview
```

This runs the app's **real** renderers (`renderReceiptBytes` / `renderCashDrawerBytes`) and writes, per sale scenario, into `web/.preview/` (git-ignored):

- `<scenario>.bin` — the exact ESC/POS bytes the app sends to the printer.
- `<scenario>.html` — a savable 80mm render (same `buildReceiptPrintHtml` used by the in-app system-print path).
- `index.html` — links to all scenarios.
- `drawer.bin` — the on-demand cash-drawer kick.

Scenarios: `cash` (drawer kick), `card` (no kick), `discount-vat`.

## Get a PDF or image

Neither emulator exports a file — they show a live preview only. To get a **PDF/image**:

1. Open `web/.preview/index.html` (or a single `<scenario>.html`) in a browser.
2. Use **Print → Save as PDF** (or screenshot for an image).

The `.html` is the same template the app prints via the system-print path, so it is faithful in content.

## See a true ESC/POS render (emulator)

Renders the actual bytes through an ESC/POS parser — useful to confirm raw commands (cut, code pages, drawer):

```bash
npx escpos-emulator                         # live HTML preview at http://localhost:3000
cat .preview/cash.bin | nc -w1 localhost 9100
```

Notes:

- The emulator listens on **TCP :9100**; the app prints over **Web Serial**. That's fine here — we feed it the same bytes the app would send, which is the part that can actually be wrong.
- The cash-drawer kick (`ESC p`, `0x1B 0x70`) is a non-printing command, so it won't show as a receipt line. Verify it at the byte level:
  ```bash
  xxd .preview/cash.bin | grep -i '1b70'   # present on cash; absent on card.bin
  ```
- `escpresso` (Rust) is an alternative with a GUI that visually renders the drawer kick, QR, and 58mm.

## Where the receipt content comes from

All three outputs derive from one model — `src/utils/receiptModel.ts` (`buildReceiptModel`):

- preview component: `src/components/pos/ReceiptPaper.tsx`
- print/preview HTML: `src/utils/receiptHtml.ts` (`buildReceiptPrintHtml`)
- ESC/POS bytes: `src/utils/thermalReceipt.tsx`

So the preview, the system print, and the thermal print can't drift. Note `discountValue` is the **resolved Rs amount**; `discountType: 'percent'` only changes the label (the % is derived from amount ÷ subtotal).

```

```
