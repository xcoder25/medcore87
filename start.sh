#!/usr/bin/env bash
# MedCore Platform — one-command start
# Starts Hospital OS Gateway (UI + API + WebSocket) on port 4000
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PORT="${PORT:-4000}"
export PORT

echo ""
echo "============================================================="
echo "  MedCore Hospital Platform"
echo "============================================================="
echo "  Hospital OS (desktop):  http://localhost:${PORT}"
echo "  API:                    http://localhost:${PORT}/api/v1"
echo "  WebSocket:              ws://localhost:${PORT}/ws"
echo ""
echo "  Mobile apps (separate terminals after npm install):"
echo "    Staff Clinic:  cd apps/clinic && npx expo start"
echo "    Patient Care:  cd apps/care   && npx expo start"
echo "    MOH Admin:     cd apps/admin  && npm run dev"
echo "============================================================="
echo ""

# Prefer zero-dep hospital gateway
if [ -f "services/hospital-gateway/server.js" ]; then
  exec node services/hospital-gateway/server.js
fi

# Fallback: simple static server for Hospital OS UI
if command -v npx >/dev/null 2>&1; then
  echo "Gateway not found — serving index.html on ${PORT}"
  exec npx --yes serve -l "$PORT" .
fi

echo "ERROR: Need Node.js to start. Install Node 18+ then re-run ./start.sh"
exit 1
