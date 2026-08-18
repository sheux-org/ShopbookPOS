# Web POS printing (chittie)

The web POS prints thermal receipts with **[chittie](https://github.com/octalpixel/chittie)**
(`@angadie/chittie*`) and the **Chittie Companion** print bridge. This replaced the old
`react-thermal-printer` path and the in-repo `tools/print-agent` (deleted) — we promoted chittie's
battle-tested agent (proven on real 58mm hardware, incl. Sinhala).

> Setting up a till or testing locally? See **[`printing-setup-and-test.md`](./printing-setup-and-test.md)**
> (store-owner + developer runbook). Editing the receipt layout? See
> **[`chittie-elements.md`](./chittie-elements.md)** (element/prop reference). This page is the architecture.

## Architecture

```
ReceiptModal / hook ──▶ thermalReceipt.tsx (chittie JSX → ESC/POS bytes)
                                 │
            useThermalPrinter ───┤  Chittie Companion (localhost:8930)  ← the single path, via @angadie/chittie-companion
                                 └  system print dialog                 ← fallback when the companion isn't running
```

- **Bytes:** `web/src/utils/thermalReceipt.tsx` builds the receipt with `@angadie/chittie`
  (`<Printer>/<Text>/<Row>/<Line>/<Feed>/<Cut>/<Cashdraw>`) from `receiptModel.ts`. It takes a
  chittie `PRINTER_PROFILES` key (`'58mm' | '80mm'`), which carries columns, dot width, and DPI
  together, and a numeric `cashDrawerDevice` (0 = pin 2, 1 = pin 5) as ESC/POS numbers them.
- **Transport:** `web/src/services/printerTransport.ts` wraps `@angadie/chittie-companion`
  (`createCompanionClient` → `localhost:8930`), which drives USB printer-class / OS-queue / TCP printers.
- **No Web Serial.** We dropped it: it can't see USB printer-class devices, is Chromium-desktop-only,
  and pops a confusing port picker. ordereka (the reference) is companion-only too. When the companion
  isn't reachable, `ReceiptModal` falls back to the **system print dialog**.
- **Non-Latin:** a browser-canvas rasterizer (`browserRasterizer` in `thermalReceipt.tsx`) shapes
  **Sinhala/Tamil** correctly. (The old UTF-8 path printed garbage on ESC/POS.) chittie sizes the
  glyphs in dots from the profile's DPI, so they are the same physical size on 203 and 300 DPI.
- **Preview:** `pnpm --filter web print:preview` renders the real bytes to PNG at both profiles —
  no printer needed. See [`chittie-elements.md`](./chittie-elements.md).

## Setup (per till)

1. **Install the Chittie Companion** on the till (Windows): the prebuilt installer —
   `https://pub-4b53b304bc45450dbe0155abfe55778b.r2.dev/chittie-companion-latest-windows-x64-setup.exe`
   It runs in the tray, auto-starts (silent), auto-detects the printer, and exposes `localhost:8930`.
   A **vendored copy** also ships in this repo at `web/public/companion/` (served at
   `/companion/chittie-companion-latest-windows-x64-setup.exe`) so you can self-host — see
   `web/public/companion/README.md`.
2. The web POS finds it automatically. Overrides (optional env):
   - `NEXT_PUBLIC_PRINT_BRIDGE_URL` (default `http://localhost:8930`)
   - `NEXT_PUBLIC_PRINT_BRIDGE_TOKEN` (must match the companion's `CHITTIE_TOKEN`)
   - `NEXT_PUBLIC_PRINT_TARGET` (optional explicit printer; default = the companion's chosen one)
   - `NEXT_PUBLIC_COMPANION_INSTALL_URL` (the in-app "Download" link; default = R2; set to
     `/companion/chittie-companion-latest-windows-x64-setup.exe` to serve your own copy)
3. No companion? The POS falls back to the **system print dialog**.

## Dev

- `pnpm --filter web run print:preview` → emits the exact ESC/POS `.bin` + an HTML render to `web/.preview/`.
- For hardware-free testing, run the Chittie Companion in **virtual mode** (renders a PNG instead of
  printing) — see the chittie repo.

## Why this changed

`tools/print-agent` (shopbook's own Rust bridge) + `react-thermal-printer` were replaced by chittie:
one published, semver'd, hardware-verified stack — receipts (ESC/POS) + labels (TSPL) + non-Latin
rasterization + a maintained Companion with auto-update. See the chittie repo for the source.
