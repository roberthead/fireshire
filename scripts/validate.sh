#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Backend ==="

echo "-- pytest --"
cd "$ROOT/backend"
poetry run pytest -v

echo ""
echo "=== Frontend ==="

cd "$ROOT/frontend"

echo "-- tsc --"
npx tsc -b

echo "-- eslint --"
npm run lint

echo "-- vitest --"
npm test

echo ""
echo "=== All checks passed ==="
