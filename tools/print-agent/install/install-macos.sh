#!/usr/bin/env bash
# Install the Shopbook print agent as a per-user LaunchAgent (auto-start at login,
# auto-restart on crash). Run once on the POS terminal.
#
#   ./install-macos.sh [path-to-binary]
#   PRINT_AGENT_TOKEN=secret ./install-macos.sh ./shopbook-print-agent
#
# Uninstall: launchctl unload "$HOME/Library/LaunchAgents/app.shopbook.printagent.plist" \
#            && rm "$HOME/Library/LaunchAgents/app.shopbook.printagent.plist"
set -euo pipefail

BIN="${1:-$(pwd)/shopbook-print-agent}"
TOKEN="${PRINT_AGENT_TOKEN:-}"
ORIGIN="${PRINT_AGENT_ALLOW_ORIGIN:-*}"
LABEL="app.shopbook.printagent"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DEST="$HOME/Library/Application Support/ShopbookPrintAgent"

[ -f "$BIN" ] || { echo "binary not found: $BIN" >&2; exit 1; }

mkdir -p "$DEST" "$HOME/Library/LaunchAgents"
cp "$BIN" "$DEST/shopbook-print-agent"
chmod +x "$DEST/shopbook-print-agent"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$DEST/shopbook-print-agent</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>EnvironmentVariables</key><dict>
    <key>PRINT_AGENT_TOKEN</key><string>$TOKEN</string>
    <key>PRINT_AGENT_ALLOW_ORIGIN</key><string>$ORIGIN</string>
  </dict>
  <key>StandardOutPath</key><string>$DEST/agent.log</string>
  <key>StandardErrorPath</key><string>$DEST/agent.log</string>
</dict></plist>
PLIST

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Shopbook print agent installed + started (auto-starts at login)."
echo "Logs: $DEST/agent.log"
