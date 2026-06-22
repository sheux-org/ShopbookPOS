# Web Serial mock (browser extension)

A tiny MV3 extension that mocks **`navigator.serial`** in the POS page so you can exercise
the app's **Web Serial transport with no serial hardware**. It's the _only_ way to fake
browser Web Serial (a userspace binary can't — the browser only enumerates driver-backed
ports; see the Chromium issue 40193442 / com0com discussion).

It does **not** render anything itself — it forwards the captured ESC/POS bytes to the
**print-agent** (`../print-agent`), which renders them to a PNG in virtual mode. One
renderer, one contract.

```
POS page ──navigator.serial mock (inject.js)──► captures bytes
        ──window.postMessage──► relay.js ──POST /print──► print-agent (PRINT_AGENT_VIRTUAL=1) ──► PNG
```

## Files

| File                      | Role                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `extension/manifest.json` | MV3; injects the two scripts on `localhost:3000`                                     |
| `extension/inject.js`     | MAIN world: replaces `navigator.serial`, captures bytes, `postMessage`               |
| `extension/relay.js`      | ISOLATED world: forwards captured bytes to the agent (`http://localhost:8930/print`) |

## Use it (no hardware)

1. Start the agent in **virtual** mode (renders PNGs):
   ```bash
   PRINT_AGENT_VIRTUAL=1 ./tools/print-agent/prebuilt/shopbook-print-agent-macos-arm64
   ```
2. Load the extension: Chrome/Edge → `chrome://extensions` → **Developer mode** → **Load
   unpacked** → select `tools/serial-mock/extension/`.
   (`--load-extension` is ignored by stable Chrome 137+, so use the UI.)
3. Open `http://localhost:3000`, print from the POS. The app's Web Serial path "connects"
   to the mock, the bytes flow to the agent, and a PNG lands in the agent's output dir.

> The bridge tier (no Web Serial involved) doesn't need this extension at all — the app
> talks to the agent directly. This extension is only for testing the **Web Serial**
> transport specifically without a serial printer.
