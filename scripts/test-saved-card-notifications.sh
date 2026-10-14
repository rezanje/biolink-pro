#!/usr/bin/env bash
# Disposable PostgreSQL only. No project credentials or published ports.
set -euo pipefail
cd "$(dirname "$0")/.."
container="gentanala-card-notifications-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:16 >/dev/null
for attempt in {1..30}; do
    if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
    sleep 1
done
run_sql() { docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }
run_sql < supabase/tests/fixtures/saved-card-notifications-bootstrap.sql
run_sql < supabase/migrations/019_public_translate_and_saved_cards.sql
run_sql < supabase/migrations/021_saved_card_folders.sql
# An existing save made before migration must not be backfilled.
run_sql <<'SQL'
INSERT INTO auth.users VALUES ('90000000-0000-0000-0000-000000000001'), ('90000000-0000-0000-0000-000000000002');
INSERT INTO public.profiles (id, user_id, slug) VALUES ('90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 'historical-card');
INSERT INTO public.saved_profiles (user_id, profile_id) VALUES ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003');
SQL
run_sql < supabase/migrations/022_saved_card_notifications.sql
run_sql <<'SQL'
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.card_save_notifications) THEN RAISE EXCEPTION 'Historical saves backfilled'; END IF;
END $$;
DELETE FROM auth.users WHERE id IN ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002');
SQL
run_sql < supabase/tests/saved-card-notifications.sql
run_sql < supabase/tests/card-folders.sql
printf 'Saved-card notification and existing folder SQL tests passed.\n'
