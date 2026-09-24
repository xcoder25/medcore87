#!/usr/bin/env bash
# MedCore Platform — hospital start
# Prefers full API + WebSocket (clinical loop + LIVE). Falls back to gateway.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PORT="${PORT:-4000}"
export PORT
export NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-ws://localhost:${PORT}/ws}"

echo ""
echo "============================================================="
echo "  MedCore Hospital Platform — Go-Live"
echo "============================================================="
echo "  API + WebSocket:   http://localhost:${PORT}"
echo "  WS:                ws://localhost:${PORT}/ws"
echo "  Docs:              GO_LIVE.md"
echo ""
echo "  Hospital OS UI (second terminal if needed):"
echo "    cd apps/os && npm install && npm run dev"
echo ""
echo "  Demo logins: see START-HERE.md / GO_LIVE.md"
echo "============================================================="
echo ""

# Full realtime API (preferred for hospital day)
if [ -f "services/api-server/src/server.ts" ] || [ -f "services/api-server/src/server.js" ]; then
  cd services/api-server
  if [ ! -d node_modules ]; then
    echo "Installing API dependencies…"
    npm install --no-audit --no-fund
  fi
  echo "Starting MedCore API + event bus on :${PORT} …"
  exec npm run dev
fi

# Legacy gateway
cd "$ROOT"
if [ -f "services/hospital-gateway/server.js" ]; then
  exec node services/hospital-gateway/server.js
fi

echo "ERROR: No API server found. See GO_LIVE.md"
exit 1
