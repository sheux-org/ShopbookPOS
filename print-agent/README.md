# Shopbook Print Agent

A tiny (~540 KB), self-contained localhost service that lets the Shopbook POS web
app print **raw ESC/POS** to a thermal printer that exposes **no serial/COM port** —
e.g. a USB printer-class device like the MINJCODE **MJ5818**. The browser can't reach
those directly; this agent receives the bytes over `localhost` and writes them to the
printer's OS queue (**Windows winspool RAW** / **CUPS** on macOS/Linux).

It lives at the **repo root** (not under `web/`) on purpose — it's a native binary, not
part of the Vercel-deployed Next.js app. It is the production sibling of the dev
`web/tools/serial-mock` and speaks the **same `/health` + `/print` contract**, so the POS
app code is identical whichever is running.

```
POS web app ──fetch http://localhost:8930/print {bytes}──► print-agent ──RAW──► printer queue
            ◄──── GET /health (auto-detected by the app) ────             └──► or PNG (virtual mode)
```

## HTTP contract

| Method | Path        | Body / Result                                                                       |
| ------ | ----------- | ----------------------------------------------------------------------------------- |
| `GET`  | `/health`   | `{ ok, service, version, platform, mode, defaultPrinter, printers[] }`              |
| `GET`  | `/printers` | `{ printers: [{ name, systemName, isDefault }] }`                                   |
| `POST` | `/print`    | body `{ bytes: number[], printer?: string }` → raw-prints to `printer` (or default) |

The app's `web/src/services/printerTransport.ts` points at `NEXT_PUBLIC_PRINT_BRIDGE_URL`
(default `http://localhost:8930`) and, if set, sends `NEXT_PUBLIC_PRINT_BRIDGE_TOKEN` as
the `x-agent-token` header.

## Virtual mode — for devs with no printer

Run with `PRINT_AGENT_VIRTUAL=1` and `/print` **renders the receipt to a PNG** instead of
printing — so a developer can see exactly what would print, no hardware required. The POS
app's bridge tier works unchanged (it just gets a `200`).

```bash
PRINT_AGENT_VIRTUAL=1 PRINT_AGENT_OUTPUT_DIR=./shopbook-receipts ./shopbook-print-agent
# each /print writes shopbook-receipts/receipt-<timestamp>.png
```

The PNG uses a public-domain 8x8 bitmap font (no font asset) and renders alignment, bold,
the cut marker, and the cash-drawer-kick badge. This is the agent's built-in equivalent of
the `serial-mock` HTML gallery.

## Configuration (environment variables)

| Var                        | Default             | Purpose                                                                                     |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `PRINT_AGENT_PORT`         | `8930`              | Localhost port.                                                                             |
| `PRINT_AGENT_TOKEN`        | _(none)_            | Shared secret; if set, `/print` requires a matching `x-agent-token`. **Set in production.** |
| `PRINT_AGENT_ALLOW_ORIGIN` | `*`                 | `Access-Control-Allow-Origin`. Set to your POS origin in production.                        |
| `PRINT_AGENT_VIRTUAL`      | _(unset)_           | When set, render PNGs instead of printing (dev).                                            |
| `PRINT_AGENT_OUTPUT_DIR`   | `shopbook-receipts` | Where virtual-mode PNGs are written.                                                        |

Security posture: binds **127.0.0.1 only** (never the network), 4 MiB body cap, optional
token, configurable CORS origin.

## Build

```bash
cd print-agent
cargo build --release          # -> target/release/shopbook-print-agent (~540 KB)
cargo clippy --release          # lint (clean)
```

## Releases (CI)

Tagging triggers `.github/workflows/print-agent-release.yml`, which cross-builds binaries
for **Windows (x64), macOS (Apple Silicon + Intel), and Linux (x64)** and publishes them
(with `.sha256` checksums) to a GitHub Release:

```bash
git tag print-agent-v0.1.0
git push origin print-agent-v0.1.0
```

To build a target locally instead:

```bash
rustup target add x86_64-pc-windows-msvc
cargo build --release --target x86_64-pc-windows-msvc   # -> shopbook-print-agent.exe
```

## Distribution to clients / merchants

The merchant installs **one binary** (no Node/JVM/runtime). Per platform:

### Windows (the POSMAX target) — auto-start service

1. Download `shopbook-print-agent-x86_64-pc-windows-msvc.exe` from the Release; verify the
   `.sha256`. Rename to `shopbook-print-agent.exe`, place in `C:\Shopbook\`.
2. Install the printer normally (Xprinter/vendor driver) so it shows in **Devices & Printers**.
3. Register auto-start (one-time, elevated terminal):
   ```bat
   sc create ShopbookPrintAgent binPath= "C:\Shopbook\shopbook-print-agent.exe" start= auto
   sc start ShopbookPrintAgent
   ```
   (or place a shortcut in `shell:startup`; or use NSSM for a friendlier service wrapper.)
4. Set a token for production: add `PRINT_AGENT_TOKEN` to the service environment and the
   matching `NEXT_PUBLIC_PRINT_BRIDGE_TOKEN` in the POS deploy.
5. Done — the POS web app auto-detects the agent via `/health` and prints silently.

### macOS — LaunchAgent

`~/Library/LaunchAgents/app.shopbook.printagent.plist` running the binary with `RunAtLoad`

- `KeepAlive`, then `launchctl load` it.

### Linux — systemd user service

`~/.config/systemd/user/shopbook-print-agent.service` with `Restart=always`, then
`systemctl --user enable --now shopbook-print-agent`.

> A signed `.msi`/`.pkg` that bundles the steps above (and starts the service) is the
> ideal merchant experience and a follow-up release-pipeline task. The binary itself needs
> no installer to run.

## Local test (no hardware)

```bash
# print mode (errors gracefully if no printer queue exists)
PRINT_AGENT_PORT=8931 ./target/release/shopbook-print-agent &
curl localhost:8931/health
curl -X POST localhost:8931/print -H 'content-type: application/json' \
  -d '{"bytes":[27,64,72,105,10],"printer":"YOUR_PRINTER_NAME"}'

# virtual mode (always works — writes a PNG)
PRINT_AGENT_PORT=8931 PRINT_AGENT_VIRTUAL=1 ./target/release/shopbook-print-agent &
curl -X POST localhost:8931/print -H 'content-type: application/json' -d '{"bytes":[...]}'
```

The raw bytes → physical print path is exercised on a terminal where the printer is an
installed queue (verified target: Windows + MJ5818).

## Relationship to the rest of the system

- App transport + smart routing: `web/src/services/printerTransport.ts`, `web/src/hooks/useThermalPrinter.ts`
- Dev stand-in that renders HTML in a browser gallery: `web/tools/serial-mock/`
- ESC/POS bytes come from `web/src/utils/thermalReceipt.tsx` — unchanged; this agent only transports (or renders) them.
- Future: this Rust core moves into the Tauri desktop app's native print command verbatim.
