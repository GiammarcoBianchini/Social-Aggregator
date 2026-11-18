#!/bin/bash
# Compila, installa la raccolta giornaliera (launchd) e stampa la configurazione per Claude Desktop.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
DATA="$HOME/Library/Application Support/hub-dati"
LABEL="com.giammarcobianchini.hub-dati"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

cd "$REPO"
npm ci
npm run build
mkdir -p "$DATA" "$HOME/Library/LaunchAgents"

sed -e "s#__NODE__#$NODE#g" -e "s#__REPO__#$REPO#g" -e "s#__DATA__#$DATA#g" \
  launchd/$LABEL.plist > "$PLIST"
if [ -n "${HUB_DATI_GSC_SITE:-}" ]; then
  /usr/libexec/PlistBuddy -c "Add :EnvironmentVariables dict" -c "Add :EnvironmentVariables:HUB_DATI_GSC_SITE string $HUB_DATI_GSC_SITE" "$PLIST"
fi
plutil -lint "$PLIST"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Raccolta giornaliera installata (08:30). Log: $DATA/collect.log"

cat <<JSON

Aggiungi a ~/Library/Application Support/Claude/claude_desktop_config.json, dentro "mcpServers":
  "hub-dati": { "command": "$NODE", "args": ["$REPO/dist/bin/mcp.js"] }
Poi riavvia Claude.
JSON
