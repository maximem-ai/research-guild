#!/usr/bin/env bash
# Runs all migrations + pgTAP tests on a throwaway local Postgres 16 (no Docker needed).
# Requires: postgresql-16, postgresql-16-pgvector, postgresql-16-cron, postgresql-16-pgtap.
# Usage: scripts/local-db/test.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=""
if [ "$(id -u)" = "0" ]; then RUN_AS="runuser -u postgres --"; chown postgres "$WORK"; fi
cleanup() { $RUN_AS "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

$RUN_AS "$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
cat >> "$WORK/data/postgresql.conf" <<CONF
port = $PORT
unix_socket_directories = '$WORK'
shared_preload_libraries = 'pg_cron'
cron.database_name = 'postgres'
listen_addresses = ''
wal_level = logical
CONF
$RUN_AS "$PGBIN/pg_ctl" -D "$WORK/data" -l "$WORK/log" -w start >/dev/null

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$ROOT/scripts/local-db/supabase_shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null
done
if [ -f "$ROOT/supabase/seed.sql" ]; then echo "seed: seed.sql"; "${PSQL[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null; fi
"${PSQL[@]}" -c "create extension if not exists pgtap with schema extensions" >/dev/null

FAIL=0
for t in "$ROOT"/supabase/tests/*.sql; do
  OUT="$("${PSQL[@]}" -t -A -f "$t" 2>&1)" || { echo "$OUT"; echo "ERROR in $(basename "$t")"; FAIL=1; continue; }
  if echo "$OUT" | grep -qE '^not ok|^# Looks like'; then
    echo "$OUT" | grep -E '^(not ok|#)' ; echo "FAIL $(basename "$t")"; FAIL=1
  else
    echo "ok   $(basename "$t") ($(echo "$OUT" | grep -c '^ok') assertions)"
  fi
done
exit $FAIL
