# Printing — setup, run in store, and test

How the **web POS** prints, for two audiences. Architecture lives in `docs/web-printing.md`; this is
the practical runbook. Printing uses **chittie** + the **Chittie Companion** (a small tray app that
talks to your thermal printer). No browser printer drivers, no Web Serial.

---

## For the store owner — set up & test before you open

Do this once per till. Takes ~3 minutes.

### 1. Install the Chittie Companion (one time)

- In the POS, go to **Profile → Thermal Printer Setup**. If it says _"Companion not running,"_ tap
  **Download for Windows**, run the installer, and launch it once.
- It lives in the **system tray** (bottom-right), **starts automatically** every time you turn on the
  computer, and finds your printer on its own. You won't need to open it again.

### 2. Set it up in the POS

Back in **Profile → Thermal Printer Setup**:

- Status should turn green: **"Chittie Companion connected & ready."** (If not, make sure the printer
  is on with paper, then tap **Re-check connection**.)
- **Paper width:** pick **58mm** or **80mm** to match your roll.
- **Cash drawer pin:** **2pin** (most drawers) or 5pin — only if a drawer is plugged into the printer.

### 3. Test before the first sale

- Tap **Print Test Receipt** → a sample receipt should print cleanly. If the columns wrap or look
  wrong, switch the **paper width** and test again.
- Tap **Open Cash Drawer** (if you have one) → it should pop.

You're ready. During the day, receipts print automatically on each sale (or via the **Print Receipt**
button). Nothing else to do.

### If something goes wrong

| Symptom                                                   | Fix                                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Nothing prints / "opened the system print dialog instead" | The Companion isn't running — check the tray (re-launch), or reinstall via the link. Make sure the printer is **on with paper**. |
| Printout is **garbled / wrong width**                     | Wrong paper size — switch **58 ↔ 80mm** in setup and re-test.                                                                    |
| **Non-Latin (Sinhala/Tamil)** looks broken                | Make sure you're on the latest app build (chittie rasterizes non-Latin); re-test.                                                |
| **Cash drawer won't open**                                | Check it's wired to the printer's drawer port and the **pin** (2/5) matches.                                                     |
| Status stuck on "not running"                             | Re-launch the Companion from the tray; tap **Re-check connection**.                                                              |

---

## For the developer — run & test locally

### Run the app

```sh
pnpm dev:web                 # Next.js dev server (web/)
```

### Run the printer bridge

- **With hardware:** install + run the **Chittie Companion** (same installer as above); it serves
  `http://localhost:8930`. The web app auto-detects it.
- **No hardware:** run the Companion in **virtual mode** (`CHITTIE_VIRTUAL=1`) — every print renders a
  **PNG** instead of hitting a printer, so you can test the full POS → companion → output path. (See the
  chittie repo for the Companion + virtual mode.)

### Test without any printer

```sh
pnpm --filter web run print:preview   # emits exact ESC/POS .bin + an HTML render to web/.preview/
pnpm --filter web run test            # vitest (receipt bytes, etc.)
```

Open `web/.preview/index.html` to eyeball each scenario (cash / card / discount-vat / drawer).

### How it routes (no Web Serial)

- **Primary:** `@angadie/chittie-companion` SDK → `localhost:8930` (`web/src/services/printerTransport.ts`).
- **Fallback:** the **system print dialog** when the Companion isn't reachable (`ReceiptModal`).
- Bytes are built with `@angadie/chittie` in `web/src/utils/thermalReceipt.tsx` (non-Latin via the
  `browserRasterizer`).

### Config (env, optional)

- `NEXT_PUBLIC_PRINT_BRIDGE_URL` — default `http://localhost:8930`
- `NEXT_PUBLIC_PRINT_BRIDGE_TOKEN` — must match the Companion's `CHITTIE_TOKEN`
- `NEXT_PUBLIC_PRINT_TARGET` — explicit printer (queue name / `usb` / `host:port`); default = the
  Companion's chosen printer
- `NEXT_PUBLIC_COMPANION_INSTALL_URL` — the in-app "Download for Windows" link; default = the R2
  installer. A vendored copy also ships at `web/public/companion/` (served at
  `/companion/chittie-companion-latest-windows-x64-setup.exe`) — set this to that path to self-host.
  See `web/public/companion/README.md`.

### Before shipping

- `pnpm --filter web run test` (vitest) · `tsc --noEmit` · `next build` — all green.
- **Print on a real thermal printer through the Companion** at least once — software checks don't prove
  paper output.
