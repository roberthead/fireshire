#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

trap 'kill 0' EXIT

echo "Starting backend on :8000..."
cd "$ROOT/backend"
poetry run uvicorn app.main:app --reload &

echo "Starting frontend on :5173..."
cd "$ROOT/frontend"
npm run dev &

sleep 2
open http://localhost:5173

wait
