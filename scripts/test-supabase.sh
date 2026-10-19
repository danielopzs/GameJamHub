#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="gamejam-rls-test-${RANDOM}-$$"
cleanup() { docker stop "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# Isolated, disposable PostgreSQL: no published ports, no production credentials.
docker run --rm -d --network none --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
for attempt in {1..60}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  if [[ "$attempt" == 60 ]]; then echo 'PostgreSQL failed to become ready' >&2; exit 1; fi
  sleep 0.25
done
docker exec -i "$container" psql -q -U postgres -v ON_ERROR_STOP=1 < supabase/tests/bootstrap.sql
docker exec -i "$container" psql -q -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/001_gamejam.sql
docker exec -i "$container" psql -q -U postgres -v ON_ERROR_STOP=1 < supabase/tests/security.sql
