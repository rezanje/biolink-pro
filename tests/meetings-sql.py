"""Validate migration/RLS and concurrent claims in a disposable PostgreSQL container.
Prepare: docker run -d --name gentanala-meetings-test -e POSTGRES_PASSWORD=fixture-only postgres:17-alpine
Run: python tests/meetings-sql.py
This script only writes to that explicitly named local fixture container.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[1]
CONTAINER='gentanala-meetings-test'
def sql(value):
    return subprocess.check_output(['docker','exec','-i',CONTAINER,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],input=value.encode()).decode().strip()
# Each run uses a fresh fixture DB, never a production Supabase connection.
sql('DROP DATABASE IF EXISTS meetings_fixture; CREATE DATABASE meetings_fixture;')
def db(value):
    return subprocess.check_output(['docker','exec','-i',CONTAINER,'psql','-U','postgres','-d','meetings_fixture','-v','ON_ERROR_STOP=1','-At'],input=value.encode()).decode().strip()
db("""
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id));
GRANT SELECT ON public.profiles TO authenticated,service_role;
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO public.profiles VALUES ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002');
""")
db((ROOT/'supabase/migrations/020_meeting_bookings.sql').read_text())
db("""
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.calendar_connections','SELECT') OR has_table_privilege('anon','public.calendar_connections','SELECT') THEN RAISE EXCEPTION 'Tokens exposed'; END IF;
 IF has_function_privilege('authenticated','public.claim_meeting_request(uuid,uuid,uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Claim RPC exposed'; END IF;
END $$;
INSERT INTO public.meeting_requests(id,profile_id,visitor_name,visitor_email,start_at,end_at,timezone)
SELECT id::uuid,'00000000-0000-4000-8000-000000000011','Fixture','fixture@example.test',now()+interval '1 day',now()+interval '1 day 30 minutes','Asia/Jakarta'
FROM (VALUES ('00000000-0000-4000-8000-000000000021'),('00000000-0000-4000-8000-000000000022')) v(id);
INSERT INTO public.meeting_requests(id,profile_id,visitor_name,visitor_email,start_at,end_at,timezone)
VALUES ('00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000012','Other','other@example.test',now()+interval '1 day',now()+interval '1 day 30 minutes','Asia/Jakarta');
""")
rows=db("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false); SELECT count(*) FROM public.meeting_requests;")
assert rows.splitlines()[-1]=='2',rows
assert db("SELECT count(*) FROM public.claim_meeting_request('00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000031','google-A','calendarA@example.test');")=='0'
def claim(id):
    return db(f"BEGIN; SET ROLE service_role; SELECT count(*) FROM public.claim_meeting_request('{id}','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000031','google-A','calendarA@example.test'); SELECT pg_sleep(0.2); COMMIT;")
with ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(claim,['00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000022']))
assert sum('\n1\n' in result for result in results)==1,results
assert db("SELECT count(*) FROM public.meeting_requests WHERE status='approving';")=='1'
# Interrupted claims stay protected from decline, and only their own retry can renew the lease.
db("UPDATE public.meeting_requests SET updated_at=now()-interval '6 minutes' WHERE status='approving';")
id=db("SELECT id FROM public.meeting_requests WHERE status='approving';")
assert db(f"SELECT count(*) FROM public.claim_meeting_request('{id}','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000033','google-B','calendarB@example.test');")=='0'
assert db(f"SELECT count(*) FROM public.claim_meeting_request('{id}','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000032','google-A','calendarA@example.test');")=='1'
assert db(f"SELECT approval_recovery FROM public.meeting_requests WHERE id='{id}';")=='t'
assert db(f"SELECT approval_attempt FROM public.meeting_requests WHERE id='{id}';").endswith('32')
print('PASS: migration applies; tokens and RPC are private; RLS isolates owners; concurrent overlapping approvals claim once; interrupted approval renews safely')
