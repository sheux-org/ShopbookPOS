#!/usr/bin/env bash
# Install the Shopbook print agent as a systemd --user service (auto-start,
# auto-restart). Run once on the POS terminal.
#
#   ./install-linux.sh [path-to-binary]
#   PRINT_AGENT_TOKEN=secret ./install-linux.sh ./shopbook-print-agent
#
# Uninstall: systemctl --user disable --now shopbook-print-agent \
#            && rm ~/.config/systemd/user/shopbook-print-agent.service
set -euo pipefail

BIN="${1:-$(pwd)/shopbook-print-agent}"
TOKEN="${PRINT_AGENT_TOKEN:-}"
ORIGIN="${PRINT_AGENT_ALLOW_ORIGIN:-*}"
DEST="$HOME/.local/bin"
UNIT_DIR="$HOME/.config/systemd/user"

[ -f "$BIN" ] || { echo "binary not found: $BIN" >&2; exit 1; }

mkdir -p "$DEST" "$UNIT_DIR"
install -m755 "$BIN" "$DEST/shopbook-print-agent"

cat > "$UNIT_DIR/shopbook-print-agent.service" <<UNIT
[Unit]
Description=Shopbook Print Agent
After=network.target

[Service]
ExecStart=$DEST/shopbook-print-agent
Restart=always
RestartSec=2
Environment=PRINT_AGENT_TOKEN=$TOKEN
Environment=PRINT_AGENT_ALLOW_ORIGIN=$ORIGIN

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now shopbook-print-agent
# Keep it running when no user is logged in (kiosk terminals).
loginctl enable-linger "$USER" 2>/dev/null || true
echo "Shopbook print agent installed + started."
echo "Logs: journalctl --user -u shopbook-print-agent -f"
