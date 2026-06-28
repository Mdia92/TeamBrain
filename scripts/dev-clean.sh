#!/usr/bin/env bash
# TeamBrain — reset local dev caches, kill ports 3010/8010, restart frontend + backend.
# Usage: bash scripts/dev-clean.sh   (Git Bash / WSL / macOS / Linux)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

kill_port() {
  local port="$1"
  if command -v npx >/dev/null 2>&1; then
    npx --yes kill-port "$port" 2>/dev/null || true
  elif command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "
      Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }
    " 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
  fi
}

echo "==> Killing dev servers on ports 3010 and 8010..."
kill_port 3010
kill_port 8010
sleep 1

echo "==> Removing frontend .next cache..."
rm -rf "$ROOT/frontend/.next"

echo "==> Removing backend build artifacts..."
rm -rf "$ROOT/backend/dist" "$ROOT/backend/build" "$ROOT/backend/.pytest_cache"

echo "==> Cleaning npm cache..."
(cd "$ROOT/frontend" && npm cache clean --force)

if [[ ! -f "$ROOT/frontend/.env.local" ]]; then
  echo "==> Creating frontend/.env.local from .env.example..."
  cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env.local"
fi

activate_venv() {
  if [[ -f "$ROOT/backend/.venv/Scripts/activate" ]]; then
    # shellcheck disable=SC1091
    source "$ROOT/backend/.venv/Scripts/activate"
  elif [[ -f "$ROOT/backend/.venv/bin/activate" ]]; then
    # shellcheck disable=SC1091
    source "$ROOT/backend/.venv/bin/activate"
  else
    echo "ERROR: backend/.venv not found. Run: cd backend && pip install -e '.[dev]'"
    exit 1
  fi
}

echo "==> Starting backend on http://127.0.0.1:8010 ..."
(
  cd "$ROOT/backend"
  activate_venv
  exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
) &
BACK_PID=$!

echo "==> Starting frontend on http://localhost:3010 ..."
(
  cd "$ROOT/frontend"
  exec npm run dev
) &
FRONT_PID=$!

echo ""
echo "Backend PID:  $BACK_PID"
echo "Frontend PID: $FRONT_PID"
echo "App:  http://localhost:3010"
echo "API:  http://127.0.0.1:8010"
echo ""
echo "Paste scripts/dev-browser-clean.js into DevTools Console once, then retry uploads."
echo "Press Ctrl+C to stop both servers."

wait
