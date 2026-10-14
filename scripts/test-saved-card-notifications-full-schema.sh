#!/usr/bin/env bash
# Replays repository product schema only into a throwaway database; no live credentials.
set -euo pipefail
cd "$(dirname "$0")/.."
container="gentanala-card-full-schema-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:16 >/dev/null
for attempt in {1..30}; do
    if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
    sleep 1
done
run_sql() { docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }
run_sql < supabase/tests/fixtures/full-schema-auth-bootstrap.sql
for migration in supabase/complete-setup.sql \
    supabase/migrations/20260219_plg_init.sql \
    supabase/migrations/20260219_tier_feature_management.sql \
    supabase/migrations/20260220_b2b_rbac.sql \
    supabase/migrations/003_fix_rls_profiles.sql \
    supabase/migrations/019_public_translate_and_saved_cards.sql \
    supabase/migrations/021_saved_card_folders.sql \
    supabase/migrations/022_saved_card_notifications.sql; do
    run_sql < "$migration"
done
run_sql < supabase/tests/saved-card-notifications-full-schema.sql
printf 'Repository full-schema notification integration passed (including absent is_master).\n'
