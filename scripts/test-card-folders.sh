#!/usr/bin/env bash
# Exercise folder ownership and card preservation in a disposable PostgreSQL DB.
set -euo pipefail
cd "$(dirname "$0")/.."
task_database_name="biolink-folder-tests-$$"
trap 'docker rm -f "$task_database_name" > /dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$task_database_name" -e POSTGRES_PASSWORD=local-test postgres:17-alpine > /dev/null
for attempt in {1..60}; do
    if docker exec "$task_database_name" pg_isready -U postgres > /dev/null 2>&1; then break; fi
    sleep 0.5
done
docker exec -i "$task_database_name" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA auth;
CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, user_id uuid, slug text, is_public boolean, tier text DEFAULT 'FREE');
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
SQL
docker exec -i "$task_database_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/019_public_translate_and_saved_cards.sql
docker exec -i "$task_database_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/021_saved_card_folders.sql
docker exec -i "$task_database_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/card-folders.sql
