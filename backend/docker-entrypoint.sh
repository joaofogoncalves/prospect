#!/bin/sh
set -e

# Apply any pending migrations against the SQLite database on the mounted volume.
# `migrate deploy` is idempotent (only applies migrations not yet recorded) and is
# the production-safe counterpart to `migrate dev` — it never prompts or generates.
echo "Applying database migrations..."
npx prisma migrate deploy

# Hand off to the container command (CMD): node dist/index.js
exec "$@"
