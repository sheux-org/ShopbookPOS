# Device-Support Audit — Shopbook POS Web App

Scope: does `web/` support the purchased hardware (ELITE POS quote)?
Tracker: `shopbook-web-device-audit.csv`. Verification: `tsc --noEmit` clean · 195 vitest tests pass · `next build` clean.

## Status counts (11 rows)

- `retested-pass`: 11
- unresolved (`retested-fail`): 0
- Errors found and fixed: **2** (F003 `ux:states-are-features`, F010 `logic`)

## Answer per purchased device

| Device                                 | Supported?             | Notes                                                                                                                                                                                  |
| -------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POSMAX i7 Windows touch terminal**   | ✅ Yes                 | Runs in Chrome/Edge; Web Serial feature-detected with graceful fallback (F011).                                                                                                        |
| **POSMAX 1D & 2D USB barcode scanner** | ✅ Yes, no setup       | USB keyboard-wedge → global scan listener adds to cart (F001/F002). Camera capture (registration) now warns on unsupported browsers (F003, fixed).                                     |
| **Xprinter XP-365B 80mm USB printer**  | ✅ Yes                 | ESC/POS receipts via Web Serial (F004) with system-print fallback (F005); 58/80mm; reprint (F007); barcode **labels** (F009); preview matches print (F008). See connection note below. |
| **POSMAX cash drawer (PM-CD094)**      | ✅ Now yes (was a gap) | F010: had **no support**; added ESC/POS drawer kick — auto on cash sales over Web Serial + on-demand open + 2/5-pin setting.                                                           |

## Fixes applied this pass

- **F010 — cash drawer (the real gap).** Web app emitted no drawer command at all. Added `<Cashdraw>` kick: auto-fires on cash sales when printing over Web Serial, plus an "Open Cash Drawer" action and a 2pin/5pin pref. Tests assert the `ESC p` (0x1B 0x70) bytes appear on cash receipts and are absent otherwise.
- **F003 — camera scan silent failure.** On Safari/Firefox the viewfinder showed but never scanned, with no message. Now shows a clear "use Chrome/Edge, a USB scanner, or type the code" notice. Updated the test that previously asserted the silent behaviour.

## Important caveats (hardware/runtime — not code-verifiable here)

1. **Cash drawer wiring.** The kick command opens the drawer **only if the drawer is wired into the XP-365B's RJ11/RJ12 port**. Confirm with ELITE POS that PM-CD094 connects to this printer. The kick also only fires on the **Web Serial** print path; on the **system-print** path the drawer opens via the printer driver's "open drawer" setting.
2. **XP-365B over USB on Windows** typically enumerates as a USB **printer-class** device, not a COM port. If no COM port appears, Web Serial can't see it → the app falls back to **system print** (install the Xprinter driver, set as default; optionally Chrome `--kiosk-printing` for silent output). Verify via Device Manager → Ports (COM & LPT).
3. **Not verified on physical hardware.** All paths are verified by tsc/tests/build and by ESC/POS byte assertions; actual printing, drawer-pop, and scanning must be confirmed once the kit is connected (Chrome/Edge).

## Screens not exercised live

None blocking. UI flows (ReceiptModal smart routing, ThermalPrinterModal, BarcodeLabelModal) were verified by type-check, unit tests on their logic/transport, and a clean production build — not by live browser interaction in this environment.
