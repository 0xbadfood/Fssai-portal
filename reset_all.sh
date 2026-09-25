#!/usr/bin/env bash
# Reset EVERYTHING for testing: all users, sessions, applications, documents and stored files.
# Everyone is signed out; accounts must be registered again.
set -euo pipefail
cd "$(dirname "$0")"
read -r DB_HOST DB_PORT DB_NAME DB_USER DB_PASS STORAGE < <(node -e '
  const c = JSON.parse(require("fs").readFileSync("config/database.json", "utf8"))
  console.log(c.host, c.port, c.database, c.user, c.password, c.storageDir)')
export PGPASSWORD="$DB_PASS" PGOPTIONS="--client-min-messages=warning"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -f server/schema.sql
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q \
  -c "TRUNCATE applications, documents, sessions, users RESTART IDENTITY CASCADE"
# storageDir is relative to the repo root (this script's directory)
STORAGE="$PWD/$STORAGE"
[[ "$STORAGE" != "$PWD/" && -d "$STORAGE" ]] && find "$STORAGE" -mindepth 1 -delete
echo "Reset done: users, sessions, applications, documents and stored files cleared."
