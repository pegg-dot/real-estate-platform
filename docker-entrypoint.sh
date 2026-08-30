#!/bin/sh
# LOT container entrypoint: wait for Postgres, apply pending migrations (idempotent), then run the CMD.
# Any command works after the migrations — `lot refresh -- --market Charlottesville` runs the engine CLIs.
set -e

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  export SUPABASE_DB_URL="$DATABASE_URL"
fi
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "✗ SUPABASE_DB_URL (or DATABASE_URL) is not set — point it at a Postgres database." >&2
  exit 1
fi

if [ "${LOT_SKIP_MIGRATIONS:-}" != "1" ]; then
  cd /app
  attempt=1
  while :; do
    # exit 2 = could not connect (database still starting) → retry; anything else is final.
    # (capture $? directly — reading it after an `if` compound yields the if's status, i.e. 0)
    set +e
    node_modules/.bin/tsx scripts/apply-migrations.ts
    code=$?
    set -e
    [ "$code" -eq 0 ] && break
    if [ "$code" -ne 2 ]; then echo "✗ migrations failed (exit $code)" >&2; exit "$code"; fi
    if [ "$attempt" -ge 20 ]; then
      # Unreachable after the budget is almost always a config problem (wrong URL, paused Supabase
      # project). Start the app anyway so /api/health can SAY so (503 + the reason) instead of a
      # crash-loop that hosts report as "deployed". LOT_MIGRATE_STRICT=1 restores the hard fail.
      if [ "${LOT_MIGRATE_STRICT:-}" = "1" ]; then echo "✗ database never became reachable" >&2; exit 2; fi
      echo "⚠ database unreachable after $attempt attempts — starting WITHOUT applying migrations; /api/health will report it. Fix SUPABASE_DB_URL and restart." >&2
      break
    fi
    echo "… database not reachable yet (attempt $attempt/20) — retrying in 3s"
    attempt=$((attempt + 1))
    sleep 3
  done
fi

cd /app/web
exec "$@"
