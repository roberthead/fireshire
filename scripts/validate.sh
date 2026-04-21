#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Backend ==="

echo "-- ensure local Postgres is running --"
if ! docker compose -f "$ROOT/docker-compose.yml" ps --services --filter status=running | grep -q '^db$'; then
  echo "Starting docker compose (db, db-test)..."
  docker compose -f "$ROOT/docker-compose.yml" up -d db db-test
fi

echo "-- alembic upgrade head --"
cd "$ROOT/backend"
poetry run alembic upgrade head

echo "-- pytest --"
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
