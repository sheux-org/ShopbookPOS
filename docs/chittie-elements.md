# chittie elements and props (API reference)

Every element and prop exported by **`@angadie/chittie@0.5.6`** (which re-exports
`chittie-core@0.5.1` + `chittie-react@0.10.1`), as pinned in `web/package.json`.

> Architecture lives in [`web-printing.md`](./web-printing.md). Runbook lives in
> [`printing-setup-and-test.md`](./printing-setup-and-test.md). The mobile port is planned in
> [`mobile-chittie-migration.md`](./mobile-chittie-migration.md). **This page is the API.**

Source of truth: the published `dist/index.d.mts` of `@angadie/chittie-react@0.10.1`. Re-check it
after any version bump — this file is a copy, not a live contract.

## Mental model

A chittie receipt is a React tree that never mounts. `render()` walks it and drives an ESC/POS
byte encoder. There is no DOM and no `react-dom`. Elements return `null`; only `render()` reads them.

Three rules follow from that, and they explain most surprises:

1. **Layout is character-cell, not pixel.** Everything is measured in columns (32 or 48), not px.
2. **`<Text>` and `<Row>` accept strings and numbers only.** Nesting a component inside them throws
   — its `print()` would never run. Put `<Row>`, `<Image>` etc. as _siblings_.
3. **Leading whitespace is stripped.** You cannot indent a `<Row>`. Use a marker like `+ ` instead.

## Elements

### `<Printer>` — root

| prop    | type     | default | notes                                                   |
| ------- | -------- | ------- | ------------------------------------------------------- |
| `width` | `number` | `48`    | Characters per line. Overrides `RenderOptions.columns`. |
| `type`  | `string` | —       | Printer model passed to the encoder, e.g. `'epson'`.    |

Has no `print()` of its own; `render()` reads its props. Everything else must be a descendant.

### `<Text>` — a line of text

| prop        | type                                | default  | notes                                              |
| ----------- | ----------------------------------- | -------- | -------------------------------------------------- |
| `align`     | `'left' \| 'center' \| 'right'`     | `'left'` |                                                    |
| `bold`      | `boolean`                           | `false`  |                                                    |
| `underline` | `boolean \| number`                 | `false`  | Number selects the underline thickness.            |
| `invert`    | `boolean`                           | `false`  | White on black.                                    |
| `size`      | `{ width: number; height: number }` | `{1,1}`  | Character magnification. `2` = double.             |
| `small`     | `boolean`                           | `false`  | ESC/POS **Font B** (~9×17 vs A 12×24). Fine print. |
| `inline`    | `boolean`                           | `false`  | Suppress the trailing newline.                     |

`small` does **not** re-flow the layout. Column arithmetic still assumes Font A, so a `small` line
holds more characters than `width` suggests. Use it for footers, not for tables.

### `<Row>` — two-column line

| prop    | type        | default | notes                                               |
| ------- | ----------- | ------- | --------------------------------------------------- |
| `left`  | `ReactNode` | —       | String/number only.                                 |
| `right` | `ReactNode` | —       | String/number only.                                 |
| `rtl`   | `boolean`   | `false` | Arabic/Hebrew: label flush-right, value flush-left. |

**The layout rule that matters:** the right cell takes its natural width (`min(right.length, columns)`),
and the left cell gets whatever remains. The left cell **wraps** onto continuation lines; it is never
truncated. There is no left/right ratio knob — if you need one, build it with `<Text>` and manual
padding, or wrap the label yourself before passing it in (see the ordereka add-on pattern below).

When `left.length + right.length` exactly equals `columns`, the two cells touch with no gap. That is
correct behaviour, not a bug, but it reads badly. Budget a gap when you choose label wording.

### `<Line>` — horizontal rule

No props. Emits a full-width rule at the current column count.

### `<Br>` — blank lines

| prop    | type     | default |
| ------- | -------- | ------- |
| `lines` | `number` | `1`     |

### `<Feed>` — precise vertical space

| prop   | type                | notes                                     |
| ------ | ------------------- | ----------------------------------------- |
| `dots` | `number` (required) | 1 dot ≈ 0.125 mm at 203 DPI. Emits ESC J. |

One-shot: it does not change global line spacing, so it cannot conflict with the image feed. Use
`<Br lines>` for line-level gaps and `<Feed dots>` for fine tuning.

This is where receipt spacing is configured. `thermalReceipt.tsx` declares it in millimetres and
converts with chittie's own `dotsPerMm(dpi)`, so the gap is the same physical size on a 203 and a
300 DPI printer:

```ts
const SPACING_MM = { beforeFooter: 3, beforeCut: 5 } as const;
const feedDots = (mm: number, dpi: number) => Math.round(mm * dotsPerMm(dpi));
```

### `<Cut>` — paper cut

| prop      | type      | default |
| --------- | --------- | ------- |
| `partial` | `boolean` | `false` |

### `<Cashdraw>` — cash-drawer kick

| prop     | type     | default | notes                               |
| -------- | -------- | ------- | ----------------------------------- |
| `device` | `number` | `0`     | `0` = connector pin 2, `1` = pin 5. |

`settingsStore` persists this number directly (`cashDrawerDevice: 0 | 1`); the settings UI labels
them "Pin 2" and "Pin 5". There is no local pin dialect to translate.

### `<Barcode>`

| prop        | type                         | default | notes                |
| ----------- | ---------------------------- | ------- | -------------------- |
| `value`     | `string` (required)          | —       |                      |
| `symbology` | `BarcodeSymbology \| number` | —       | From `chittie-core`. |
| `height`    | `number`                     | —       | In dots.             |

### `<QRCode>`

| prop    | type                | default |
| ------- | ------------------- | ------- |
| `value` | `string` (required) | —       |
| `size`  | `number`            | —       |
| `model` | `number`            | —       |

### `<Image>` — raster (logos, rendered text)

| prop               | type                                                       | default     | notes                                                      |
| ------------------ | ---------------------------------------------------------- | ----------- | ---------------------------------------------------------- |
| `image`            | `ImageData` (required)                                     | —           | From a canvas, decoded PNG, or a rasterizer.               |
| `width` / `height` | `number`                                                   | image's own | Output dots, padded to a multiple of 8.                    |
| `align`            | `'left' \| 'center' \| 'right'`                            | `'left'`    |                                                            |
| `dither`           | `'threshold' \| 'bayer' \| 'floydsteinberg' \| 'atkinson'` | —           | `threshold` for line art and logos; the others for photos. |
| `threshold`        | `number`                                                   | —           | Cutoff for `dither="threshold"`.                           |

## `render(element, options)`

Returns `Uint8Array` of ESC/POS bytes. Pure — no network, no DOM.

| option         | type             | default        | notes                                                                                 |
| -------------- | ---------------- | -------------- | ------------------------------------------------------------------------------------- |
| `columns`      | `number`         | `48`           | Overridden by `<Printer width>`.                                                      |
| `dotWidth`     | `number`         | `columns × 12` | Printable width in dots. Always pass the profile's value.                             |
| `dpi`          | `number`         | `203`          | Keeps rasterized text the same physical size across printers.                         |
| `fontFamilies` | `string[]`       | —              | Fallback chain for rasterized non-Latin text.                                         |
| `rasterizer`   | `TextRasterizer` | —              | Required for Sinhala/Tamil. Without one, chittie **throws** rather than printing `?`. |
| `codepage`     | `Codepage`       | `'cp437'`      | Decides what is encodable as text.                                                    |

## `PRINTER_PROFILES`

| key          | columns | dotWidth | dpi |
| ------------ | ------- | -------- | --- |
| `'58mm'`     | 32      | 384      | 203 |
| `'80mm'`     | 48      | 576      | 203 |
| `'58mm-300'` | 48      | 576      | 300 |
| `'80mm-300'` | 72      | 864      | 300 |

Always take `columns` **and** `dotWidth` from the same profile entry. Mixing them silently corrupts
raster placement.

## Helpers re-exported from `chittie-text`

| export                         | use                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `formatMoney(amount, opts)`    | Money without `Intl` — safe on Hermes/React Native, where `Number.toLocaleString` silently drops grouping. Options: `currency`, `decimals`, `group`, `decimal`, `position`, `space`. |
| `needsRaster(text, codepage?)` | True when the code page cannot represent the text (always true for Indic scripts).                                                                                                   |
| `foldTypographic(text)`        | `×` → `x`, `…` → `...`, so smart punctuation does not force a raster.                                                                                                                |
| `sanitizeControl(text)`        | Strips C0 + DEL, so a product name carrying raw ESC/GS bytes cannot inject printer commands.                                                                                         |
| `dotsPerMm(dpi?)`              | 203 DPI → 8, 300 DPI → ~12.                                                                                                                                                          |
| `toText(node)`                 | Recursive text extraction; throws on a component element.                                                                                                                            |

`receiptModel.formatMoney` wraps chittie's, so the thermal receipt, the HTML preview, and the
system-print HTML all format money through one function that needs no `Intl` — which is what the
mobile port will need under Hermes.

`sanitizeControl` and `foldTypographic` do **not** need to be called by hand: `<Text>` and `<Row>`
apply them internally before encoding. They are exported for text you format outside an element.

## Patterns worth copying from ordereka

`ordereka-fashion-pos/packages/receipt/src/receipt.tsx` is the most mature chittie receipt we have.
The techniques below are proven on real 58mm hardware.

**Profile in, not width in.** Its API takes `profile?: '58mm' | '80mm'` and derives `columns` and
`dotWidth` from one lookup, so the two cannot drift. `thermalReceipt.tsx` now does the same, and
`settingsStore` persists the chittie profile key directly rather than a millimetre number that
something else has to translate.

**Wrap the label yourself when a `<Row>` would collide.** Because `<Row>` gives the right cell its
natural width, a long free-text label runs into the figure. ordereka pre-wraps with
`wrapToWidth(label, columns - right.length - 3)` and prints the continuation as plain `<Text>`.
This is the general answer to "the price is touching the name".

**`+ ` instead of indentation.** Leading whitespace is stripped from both `<Row>` and `<Text>`, so a
subordinate row cannot be indented. ordereka marks add-on rows with `+ ` and lets continuation lines
carry no marker, so the label reads as one unit.

**Suppress rows that repeat information.** `cashTenderedChange()` hides tendered/change when the
payment was exact, because TOTAL already says it. Ours always prints both. Less ink, less noise.

**Print the logo _or_ the name, never both.** `{!opts.logo && <Text ...>{businessName}</Text>}` —
the logo already carries the brand.

**Trim the logo's white padding.** `trimLogoVerticalPadding()` crops uniform white rows so the
address sits tight under the artwork, instead of floating below a canvas margin.

**Ship a `testReceiptBytes()` and a `drawerKickBytes()`.** Both are self-contained, need no order
data, and go through the identical print path — so a field diagnostic tests what the receipt tests.
We have `renderTestReceiptBytes` but no standalone drawer kick beyond `renderCashDrawerBytes`.

**Verify bytes in CI without hardware.** `scripts/verify-bytes.ts` asserts the output contains
`ESC @` (init), `GS V` (cut), and `ESC p` (drawer pulse). It is ten lines and catches a broken
render before anyone loads paper.

**Preview to PNG before printing.** `scripts/preview.ts` renders the real element tree through
`@angadie/chittie-preview` + `@napi-rs/canvas` to a PNG. Ours is `web/scripts/print-preview.mts`
(`pnpm --filter web print:preview`) — see below.

## Hardware lessons already paid for

From ordereka's `CHITTIE-UPGRADE.md`, learned on an ET PR-10:

- **A layout built for 80mm wraps every price and rule on a 58mm printer.** 48 columns of content
  on a 32-column roll is the single most common visual defect. Match the profile to the actual roll.
- **Non-Latin lines double-spaced** before `chittie-react@0.7.0`; `smartText` now reports whether it
  rasterized so `<Text>` skips the redundant feed. We are on 0.10.1, so we have the fix.
- **DPI-aware rasterization** keeps non-Latin text the same physical size across 58/80mm and
  203/300 DPI. Pass `dpi` from the profile rather than guessing `fontSize`.

## Offline preview harness

```bash
pnpm --filter web print:preview
```

`web/scripts/print-preview.mts` renders the real receipt element tree to PNG through
`@angadie/chittie-preview` + `@napi-rs/canvas`, for every sale scenario at **both** profiles, into
`web/.preview/` (gitignored). Open `.preview/index.html` to compare them side by side.

Run it every time the receipt changes. A layout that looks right at 48 columns routinely breaks
at 32 — that mismatch is the most common visual defect in the field.
