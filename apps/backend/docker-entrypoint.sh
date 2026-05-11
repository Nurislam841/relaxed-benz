#!/bin/sh
set -e

# Wait for postgres to actually accept connections — Docker healthcheck
# sometimes reports healthy before the DB is ready for client connections.
echo "Waiting for postgres..."
ATTEMPTS=0
until echo "SELECT 1" | npx prisma db execute --stdin >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [ "$ATTEMPTS" -ge 30 ]; then
    echo "ERROR: postgres not reachable after 30 attempts (60s)"
    exit 1
  fi
  echo "  postgres not ready (attempt $ATTEMPTS/30), retrying in 2s..."
  sleep 2
done
echo "Postgres is reachable."

echo "Running database migrations..."
npx prisma migrate deploy

echo "Generating Prisma Client..."
npx prisma generate

echo "Running seed (idempotent)..."
npx ts-node prisma/seed.ts || echo "Seed skipped or already applied"

echo "Starting backend..."
if [ -f "dist/main.js" ]; then
  echo "Found dist/main.js"
  exec node dist/main.js
elif [ -f "dist/src/main.js" ]; then
  echo "Found dist/src/main.js (NestJS structure)"
  exec node dist/src/main.js
else
  echo "CRITICAL: main.js not found in dist/ or dist/src/"
  ls -R dist/
  exit 1
fi
