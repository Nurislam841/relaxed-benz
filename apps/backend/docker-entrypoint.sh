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

# NOTE on migrations:
#   The original repo created the Quiz/Kahoot/QuizSession tables via
#   `prisma db push` (no migration files committed). Later commits added
#   incremental migrations (quiz_difficulty, user_achievements, telegram_chat_id)
#   that reference those tables. `migrate deploy` therefore can't run cleanly
#   on a fresh DB — the incremental migrations explode on missing tables.
#
#   Workaround: use `db push --accept-data-loss` to force-sync the schema.
#   This bypasses migration tracking entirely and stamps whatever schema.prisma
#   says onto the DB. Safe for dev/demo; would need a real backfill migration
#   for production-with-existing-data.
# Pre-migration data cleanup. The Achievements feature was removed in
# May 2026; existing prod databases still have ACHIEVEMENT-typed rows in
# `notifications` that block the enum value from being dropped during db
# push. These statements are idempotent: on a fresh DB they match zero
# rows / drop nothing. We swallow errors with `|| true` so any future
# similar transition can land without bricking boot.
echo "Pre-migration cleanup (legacy data)..."
echo "DELETE FROM notifications WHERE type::text = 'ACHIEVEMENT';" \
  | npx prisma db execute --stdin >/dev/null 2>&1 || true
echo "DROP TABLE IF EXISTS user_achievements CASCADE;" \
  | npx prisma db execute --stdin >/dev/null 2>&1 || true

echo "Syncing schema (db push)..."
npx prisma db push --skip-generate --accept-data-loss

echo "Generating Prisma Client..."
npx prisma generate

echo "Running seed (idempotent — skips when admin user already exists)..."
# Use Prisma's built-in `db seed` which reads the `prisma.seed` block in
# package.json. More reliable than calling ts-node directly:
#  - resolves tsconfig automatically
#  - works whether or not ts-node is in PATH
#  - logs the seed script's actual status
# We still tolerate failure (`|| echo`) so a transient DB hiccup doesn't
# block boot — the seed is fully idempotent (the script returns early if
# the admin user already exists).
npx prisma db seed || echo "Seed skipped or failed (non-fatal, see logs above)"

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
