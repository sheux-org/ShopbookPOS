# Mobile (React Native) → chittie — migration guide

Plan for moving the **mobile** POS (`mobile/`, Expo 54 / RN 0.81) thermal printing onto
**[chittie](https://github.com/octalpixel/chittie)** (`@angadie/chittie*`), mirroring what we already
shipped on web. **This is the plan — do not migrate yet.** Follow it as written; the order matters.

---

## Where we are today (facts)

- **Receipt bytes:** `mobile/utils/printThermalReceipt.ts` → `buildThermalReceiptText()` hand-assembles
  an ESC/POS **string** (`\x1B\x40` init, `\x1D\x21\x11` size, a manual `formatLine()` that pads
  columns by counting characters). Returns a `string`.
- **Transport:** `react-native-bluetooth-classic` — `RNBluetoothClassic.connectToDevice(address)` then
  **`device.write(textData, 'utf-8')`**. Pairing/discovery UI lives in
  `mobile/app/(modules)/profile/bluetooth-printer.tsx`; the paired device is in `useSettingsStore.pairedPrinter`.
- **Fallback:** `expo-print` (`Print.printAsync({ html })`) via `thermalReceiptHtml.ts`.

### Why migrate

1. **Hand-rolled ESC/POS is fragile** — `formatLine`'s char-count padding breaks with proportional
   data, can't do logos/barcodes/QR cleanly, and drifts from the web receipt. chittie gives a
   declarative `<Printer>/<Text>/<Row>` tree shared in spirit with web.
2. **`device.write(text, 'utf-8')` prints garbage for Sinhala/Tamil.** Raw UTF-8 bytes are not what an
   ESC/POS printer's code page expects. chittie **rasterizes** non-Latin to a bitmap — the fix.
3. **One stack, one mental model** — web already uses chittie (`docs/web-printing.md`); mobile should too.

---

## Target architecture

```
PaymentTender / OrderHistory ──▶ buildReceiptBytes() (chittie JSX → Uint8Array)
                                       │
   printReceipt() ────────────────────┤  Android / Classic SPP: react-native-bluetooth-classic   ── write base64(bytes)
                                       │  iOS / BLE printers:    react-native-ble-nitro            ── chunked writes per MTU
                                       └  fallback: expo-print (system / PDF)
```

- **Bytes:** `@angadie/chittie` (`render(<Receipt/>) → Uint8Array`). Pure JS, RN-safe (no `react-dom`,
  no `Buffer`) — verified under Hermes.
- **Transport:** `@angadie/chittie-transport-react-native` — _library-agnostic_; it provides the
  `Transport` contract + encoding helpers (`toBase64`, `chunk`). You keep **two** adapters behind it —
  `react-native-bluetooth-classic` (Android/Classic) and `react-native-ble-nitro` (iOS/BLE) — and route
  by the paired device's type. Write bytes as **base64** (not utf-8) so high/raster bytes survive. See
  the **Step 2 decision** for why two adapters, not a unified library.
- **Non-Latin rasterizer:** RN has no DOM canvas, so this is the one real decision — see Step 3.

---

## Step 0 — install

```sh
cd mobile
npx expo install @angadie/chittie @angadie/chittie-transport-react-native
# Non-Latin (pick one in Step 3): @angadie/chittie-react-native (Nitro) OR @shopify/react-native-skia
```

chittie ships ESM; Expo/Metro resolves it. Requires no native build for the **byte** path (only the
rasterizer in Step 3 is native).

---

## Step 1 — receipt bytes (replace `buildThermalReceiptText`)

Rewrite `buildThermalReceiptText()` as a chittie tree, mirroring `web/src/utils/thermalReceipt.tsx`
(its `BuildThermalReceiptOptions` already matches). Keep the same options in/out; only the body changes.

```tsx
import { Printer, Text, Row, Line, Br, Cut, render, PRINTER_PROFILES } from '@angadie/chittie';
import type { BuildThermalReceiptOptions } from './thermalReceiptHtml';

export function buildReceiptBytes(opts: BuildThermalReceiptOptions, widthChars = 32): Uint8Array {
  const { columns, dotWidth } =
    widthChars <= 32 ? PRINTER_PROFILES['58mm'] : PRINTER_PROFILES['80mm'];
  return render(
    <Printer width={columns}>
      <Text align="center" bold size={{ width: 2, height: 2 }}>
        {opts.businessName}
      </Text>
      <Text align="center">{opts.category}</Text>
      <Text align="center">{opts.address}</Text>
      {opts.phone ? <Text align="center">Tel: {opts.phone}</Text> : null}
      <Line />
      <Row left="Cashier" right={opts.cashierLabel} />
      {opts.invoiceLabel ? <Row left="Invoice" right={opts.invoiceLabel} /> : null}
      <Row left="Date" right={opts.dateStr} />
      <Line />
      {opts.items.map((it, i) => (
        <Row key={i} left={`${it.quantity}x ${it.name}`} right={`Rs. ${it.lineTotal.toFixed(2)}`} />
      ))}
      <Line />
      <Row left="Subtotal" right={`Rs. ${opts.subtotal.toFixed(2)}`} />
      <Row left={opts.taxLabel || 'Tax'} right={`Rs. ${opts.tax.toFixed(2)}`} />
      {opts.discount ? (
        <Row left={opts.discountLabel || 'Discount'} right={`-Rs. ${opts.discount.toFixed(2)}`} />
      ) : null}
      <Line />
      <Row left="TOTAL" right={`Rs. ${opts.grandTotal.toFixed(2)}`} />
      <Br />
      <Text align="center" small>
        Thank you for visiting!
      </Text>
      <Cut />
    </Printer>,
    { dotWidth, rasterizer /* Step 3; omit for Latin-only */ }
  );
}
```

Notes:

- `render()` is **synchronous** and returns `Uint8Array` (web wraps it in `Promise` for API parity).
- chittie's `<Cut>` emits `GS V`; the manual 5× `\n` tearable tail is no longer needed (or keep a
  `<Br lines={4} />`).
- `<Text small>` (Font B) is good for the footer; `formatMoney` from `@angadie/chittie` can replace the
  `.toFixed(2)` + `Rs.` if you want web parity.
- Use `<Row>` for columns — drop `formatLine()` entirely.

---

## Step 2 — transport

### Decision: two thin adapters behind one chittie contract (do not re-litigate)

We keep **two** Bluetooth transports, both wrapped by `@angadie/chittie-transport-react-native`'s
`Transport` contract, and route by the paired device's type:

| Printer / platform                                      | Library                                                                   | Notes                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Classic SPP printers (Android)** — the SL mass market | **`react-native-bluetooth-classic`**                                      | RFCOMM/SPP. The 13-line iOS patch stays (it only makes iOS _compile_). On an RC (`1.73.0-rc.17`) — track for a stable to drop the patch. |
| **BLE printers / iOS**                                  | **`react-native-ble-nitro`** (or `react-native-ble-plx` for max maturity) | GATT writes, chunked per MTU. The only way to print on iOS.                                                                              |

**Why this, and not a single unified library** (the questions that come up, settled):

- **The Sri Lankan installed base is Classic SPP** (Xprinter/Goojprt/generic 58mm from Daraz/Ozone/
  printers.lk — Android+Windows, no iOS). Dropping Classic orphans the printers shops already own.
- **iOS Classic SPP is impossible** for these printers — it needs Apple's External Accessory + **MFi**,
  which cheap printers don't have. So "Classic on iOS" cannot exist regardless of library.
- **Don't fork `ble-nitro` to add Classic.** Classic would be **Android-only anyway** (see MFi), so
  you'd be re-implementing Android RFCOMM in Nitro + owning a fork — weeks of native work + maintenance
  to duplicate what `react-native-bluetooth-classic` already does. The 13-line patch is far cheaper.
- **chittie is transport-agnostic**, so two thin adapters cost almost nothing and cover _more_ hardware
  than a unified lib could. A unified Nitro Bluetooth library is a separate OSS product, not a step here.

### Write **bytes as base64**, not a utf-8 string

Whichever transport, render chittie bytes and write them **base64** (the old `'utf-8'` write corrupts
high/raster bytes):

```ts
import { toBase64, chunk } from '@angadie/chittie-transport-react-native';

const bytes = buildReceiptBytes(opts, paperWidthChars);

// Classic SPP (Android) — write the whole stream
const device = await RNBluetoothClassic.connectToDevice(pairedPrinter.address);
await device.write(toBase64(bytes), 'base64'); // was: device.write(text, 'utf-8')

// BLE (iOS / BLE printers) — chunk per MTU to the writable characteristic
// await ble.requestMTU(id, 256);
// for (const part of chunk(bytes, 180)) await ble.writeCharacteristic(id, svc, ch, toBase64(part), false);
```

- **Why base64:** chittie bytes include high/raster bytes (logos, rasterized Sinhala). `'utf-8'`
  re-encodes them and corrupts the stream; `'base64'` is byte-exact.
- Keep the existing fallback ladder (Try Again / System Print via `expo-print`) unchanged.

---

## Step 3 — non-Latin rasterizer (the one real decision)

chittie throws (never prints `?`) on non-Latin **unless** you pass a `rasterizer`. RN has no DOM canvas,
so choose:

| Option                                                      | What                                                                                | Status / cost                                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **A. Latin-only (Phase 1)**                                 | Omit `rasterizer`; English receipts only                                            | Zero work; matches _today's_ real behavior (UTF-8 never rendered Sinhala correctly either). Ship this first.                  |
| **B. `@angadie/chittie-react-native`** (recommended target) | Native Nitro rasterizer (CoreText / android.graphics) implementing `TextRasterizer` | The purpose-built path (see chittie `docs/rfc/rn-native.md`). **Not yet published** — needs a device build. Adopt when ready. |
| **C. `@shopify/react-native-skia`** (interim non-Latin)     | Skia `Paragraph` → `Surface.makeImageSnapshot()` → `readPixels()` → `ImageData`     | Works now, but a large GPU dep for one bitmap. Use only if you need Sinhala/Tamil before B ships.                             |

**Recommendation:** ship **A** (Latin) in the migration, then **B** when `chittie-react-native` is
published. Don't pull in Skia unless non-Latin is a hard launch requirement.

---

## Platform realities (read before estimating)

- **iOS has no Classic Bluetooth SPP without MFi.** `react-native-bluetooth-classic` is effectively
  **Android-only**. Cheap Classic-SPP thermal printers won't work on iPhone — target **BLE** printers
  for iOS, or keep mobile printing Android-only and let iOS use `expo-print`.
- **BLE:** ~20-byte default writes; raise MTU on Android, chunk at ~180 (chittie helpers do this).
- **Sunmi / iMin built-ins:** their Android service accepts only a _subset_ of ESC/POS via `sendRAWData`;
  use the device SDK for cut/QR/images. chittie generates standard ESC/POS — verify on the device.
- Paper width: 58mm = 32 cols / 384 dots, 80mm = 48 / 576 (`PRINTER_PROFILES`). Mobile currently
  hard-codes `width = 32`; make it a setting like web (`thermalPaperWidth`).

---

## Verify (hardware-free + on-device)

- **Preview:** `@angadie/chittie-preview` `renderReceipt(bytes, { createCanvas })` renders the exact
  bytes to an image (use `@napi-rs/canvas` in a Node script, like web's `print:preview`) — confirms
  layout before touching a printer.
- **On-device:** print on a real Android Classic-SPP printer (the primary mobile target). Verify
  alignment, the cut, and — if you adopted B/C — a Sinhala line.

## Files to touch

- `mobile/utils/printThermalReceipt.ts` — `buildThermalReceiptText` → `buildReceiptBytes` (chittie);
  `printReceipt` write path → base64. Delete `formatLine`.
- `mobile/app/(modules)/profile/bluetooth-printer.tsx` — unchanged (discovery/pairing stays); optionally
  add a paper-width toggle.
- `mobile/stores/useSettingsStore.ts` — add `thermalPaperWidth` (58/80) like web.
- `mobile/utils/thermalReceiptHtml.ts` + `expo-print` — keep as the system fallback.

## Out of scope / non-goals

- No localhost Companion on mobile — a phone can't run it; mobile prints **direct** to the printer
  (Classic/BLE). The Companion is the _desktop/web_ path.
- Don't change the pairing UX or the `expo-print` fallback in this migration.
