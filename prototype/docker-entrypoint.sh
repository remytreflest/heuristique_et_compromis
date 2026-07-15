#!/bin/sh
set -e

echo "[entrypoint] Applying database schema (prisma db push)..."
npx prisma db push --skip-generate

set +e
node prisma/needs-seed.js
NEEDS_SEED=$?
set -e

if [ "$NEEDS_SEED" -eq 0 ]; then
  echo "[entrypoint] Empty database detected — seeding demo data..."
  npm run seed
else
  echo "[entrypoint] Existing data found — skipping seed."
fi

exec "$@"
