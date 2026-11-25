// Uji 028 (baca profil dibatasi) di Postgres lokal, data dummy saja.
// Usage: NFC_PG_TOOLS=<folder dengan embedded-postgres dan pg terpasang> node supabase/tests/profile-read/run.mjs .
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const here = path.dirname(new URL(import.meta.url).pathname)
const require = createRequire(path.join(process.env.NFC_PG_TOOLS || here, 'package.json'))
const EmbeddedPostgres = require('embedded-postgres').default
const pg = require('pg')

const repo = process.argv[2]
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8')
const FIXTURE = read('supabase/tests/nfc-access/fixture.sql')
const M023 = read('supabase/migrations/023_nfc_public_functions.sql')
const M024 = read('supabase/migrations/024_lock_nfc_data_access.sql')
const M025 = read('supabase/migrations/025_promo_bundle_entitlements.sql')
const M026 = read('supabase/migrations/026_company_card_theme.sql')
const M028 = read('supabase/migrations/028_profile_read_scope.sql')
const RB028 = read('supabase/rollback/028_profile_read_scope_rollback.sql')

const U = { owner: 'a0000000-0000-0000-0000-000000000001', other: 'a0000000-0000-0000-0000-000000000002', admin: 'a0000000-0000-0000-0000-000000000003',
  newbie: 'a0000000-0000-0000-0000-000000000006', fresh: 'a0000000-0000-0000-0000-000000000008', b2b: 'a0000000-0000-0000-0000-000000000009',
  promo: 'a0000000-0000-0000-0000-000000000010', late: 'a0000000-0000-0000-0000-000000000011' }
const S = (n) => `50000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`

const port = 54343
const dataDir = path.join(here, 'data')
fs.rmSync(dataDir, { recursive: true, force: true })
const db = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port, persistent: false })
await db.initialise(); await db.start(); await db.createDatabase('nfc')
const c = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'nfc' })
await c.connect()

async function as(role, uid, sql, params = [], keep = true) {
  await c.query('BEGIN')
  try {
    await c.query(`SET LOCAL ROLE ${role}`)
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid || ''])
    const r = await c.query(sql, params)
    await c.query(keep ? 'COMMIT' : 'ROLLBACK')
    return { rows: r.rows, count: r.rowCount }
  } catch (e) { await c.query('ROLLBACK'); return { error: e.message, rows: [], count: 0 } }
}
const q = async (sql, params = []) => (await c.query(sql, params)).rows
const results = []
const check = (phase, name, ok, note = '') => results.push({ phase, name, ok: !!ok, note })
const prof = async (uid) => (await q(`SELECT slug, bio, display_name, tier::text tier, subscription_valid_until v, unlocked_templates t, feature_grants f, special_editions e FROM public.profiles WHERE user_id = $1`, [uid]))[0]
const days = (d) => d ? Math.round((new Date(d) - Date.now()) / 86400000) : null

// ---------- Lingkungan: fixture 024 + kolom/tabel versi produksi ----------
await c.query(FIXTURE)
await c.query(`
  ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb DEFAULT '{}'::jsonb;
  CREATE TYPE public.user_tier AS ENUM ('FREE', 'PREMIUM', 'B2B');
  ALTER TABLE public.profiles ALTER COLUMN tier DROP DEFAULT;
  ALTER TABLE public.profiles ALTER COLUMN tier TYPE public.user_tier USING tier::public.user_tier;
  ALTER TABLE public.profiles ALTER COLUMN tier SET DEFAULT 'FREE';
  ALTER TABLE public.profiles ADD COLUMN theme jsonb DEFAULT '{}'::jsonb, ADD COLUMN social_links jsonb DEFAULT '[]'::jsonb, ADD COLUMN avatar_url text;
  -- Sama dengan produksi: tidak ada ownership_logs, special_editions jsonb.
  DROP TABLE public.ownership_logs;
  ALTER TABLE public.profiles ALTER COLUMN special_editions TYPE jsonb USING coalesce(to_jsonb(special_editions), '[]'::jsonb);
  ALTER TABLE public.profiles ALTER COLUMN special_editions SET DEFAULT '[]'::jsonb;
  ALTER TABLE public.serial_numbers ALTER COLUMN special_editions TYPE jsonb USING coalesce(to_jsonb(special_editions), '[]'::jsonb);
  ALTER TABLE public.serial_numbers ALTER COLUMN special_editions SET DEFAULT '[]'::jsonb;
  CREATE TABLE public.tier_configs (tier public.user_tier PRIMARY KEY, features jsonb NOT NULL DEFAULT '{}', updated_at timestamptz DEFAULT now());
  ALTER TABLE public.tier_configs ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Allow public read-only access" ON public.tier_configs FOR SELECT USING (true);
  CREATE POLICY "Allow update access to admins" ON public.tier_configs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  GRANT ALL ON public.tier_configs TO anon, authenticated, service_role;
  INSERT INTO public.tier_configs (tier, features) VALUES ('FREE', '{"sync": false}'), ('PREMIUM', '{"sync": true}'), ('B2B', '{"sync": true}');
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at, raw_user_meta_data) VALUES
   ('${U.fresh}', 'rani.putri@example.test', now(), now(), '{"full_name": "Rani Dummy"}'),
   ('${U.b2b}', 'b2b@example.test', now(), now() - interval '9 days', '{}'),
   ('${U.promo}', 'promo@example.test', now(), now(), '{}'),
   ('${U.late}', 'late@example.test', now(), now(), '{}');
  INSERT INTO public.profiles (user_id, slug, display_name, email, tier) VALUES ('${U.b2b}', 'b2b-dummy', 'B2B', 'b2b@example.test', 'B2B');
  UPDATE public.profiles SET bio = 'Bio lama owner' WHERE user_id = '${U.owner}';
  INSERT INTO public.serial_numbers (serial_uuid, product_id, special_editions) VALUES
   ('${S(10)}', 'd0000000-0000-0000-0000-000000000001', '[]'), ('${S(11)}', 'd0000000-0000-0000-0000-000000000001', '[]'),
   ('${S(12)}', 'd0000000-0000-0000-0000-000000000001', '["aruna"]'), ('${S(13)}', 'd0000000-0000-0000-0000-000000000001', '[]'),
   ('${S(14)}', 'd0000000-0000-0000-0000-000000000001', '[]'), ('${S(15)}', 'd0000000-0000-0000-0000-000000000001', '[]'),
   ('${S(16)}', 'd0000000-0000-0000-0000-000000000001', '[]'), ('${S(17)}', 'd0000000-0000-0000-0000-000000000001', '[]');
`)
await c.query(M023)
await c.query(M024)
await c.query(M025)
check('setup', 'migrasi 025 jalan di atas 023 + 024', true)


await c.query(M026)
// Tabel dan kebijakan seperti di produksi sebelum 028.
await c.query(`
  CREATE TABLE public.saved_profiles (user_id uuid, profile_id uuid, folder_id uuid, created_at timestamptz DEFAULT now(), PRIMARY KEY (user_id, profile_id));
  ALTER TABLE public.saved_profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Members read saved profiles" ON public.saved_profiles FOR SELECT USING (user_id = auth.uid());
  CREATE POLICY "Members save public profiles" ON public.saved_profiles FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = saved_profiles.profile_id AND p.is_public IS DISTINCT FROM false));
  CREATE TABLE public.ai_concierge_settings (profile_id uuid PRIMARY KEY, enabled boolean DEFAULT true, persona text);
  ALTER TABLE public.ai_concierge_settings ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public reads enabled concierge settings" ON public.ai_concierge_settings FOR SELECT USING (enabled AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ai_concierge_settings.profile_id AND p.is_public IS DISTINCT FROM false));
  CREATE TABLE public.ai_concierge_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid, body text);
  ALTER TABLE public.ai_concierge_messages ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public writes concierge messages" ON public.ai_concierge_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ai_concierge_messages.profile_id AND p.is_public IS DISTINCT FROM false));
  GRANT ALL ON public.saved_profiles, public.ai_concierge_settings, public.ai_concierge_messages TO anon, authenticated;
  CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
  ALTER TABLE public.profiles ADD COLUMN user_tag text, ADD COLUMN company text, ADD COLUMN job_title text;
  UPDATE public.profiles SET user_tag = 'INTERNAL' WHERE user_id = '${U.admin}';
`)
const pid = async (uid) => (await q(`SELECT id::text FROM public.profiles WHERE user_id = $1`, [uid]))[0].id
const P_OWNER = await pid(U.owner), P_OTHER = await pid(U.other)
await q(`INSERT INTO public.ai_concierge_settings (profile_id, persona) VALUES ($1, 'dummy')`, [P_OWNER])

let r = await as('anon', null, `SELECT count(*)::int n FROM public.profiles`)
check('before', 'sebelum 028: pengunjung tanpa login bisa membaca semua profil (celah)', r.rows[0]?.n > 3)

await c.query(M028)
check('setup', 'migrasi 028 jalan di atas 023–026', true)

r = await as('anon', null, `SELECT count(*)::int n FROM public.profiles`)
check('read', 'pengunjung tanpa login tidak bisa membaca tabel profil', r.rows[0]?.n === 0)
r = await as('authenticated', U.other, `SELECT user_id::text u FROM public.profiles`)
check('read', 'pengguna biasa hanya melihat profilnya sendiri', r.rows.length === 1 && r.rows[0].u === U.other)
r = await as('authenticated', U.admin, `SELECT count(*)::int n FROM public.profiles`)
check('read', 'super admin melihat semua profil', r.rows[0]?.n === (await q(`SELECT count(*)::int n FROM public.profiles`))[0].n)
r = await as('authenticated', 'a0000000-0000-0000-0000-000000000004', `SELECT user_id::text u FROM public.profiles ORDER BY 1`)
const coA = (await q(`SELECT user_id::text u FROM public.profiles WHERE company_id = 'c0000000-0000-0000-0000-00000000000a' OR user_id = 'a0000000-0000-0000-0000-000000000004' ORDER BY 1`)).map(x => x.u)
check('read', 'admin perusahaan melihat anggota perusahaannya saja', JSON.stringify(r.rows.map(x => x.u)) === JSON.stringify(coA), JSON.stringify(r.rows))

r = await as('anon', null, `SELECT public.nfc_public_profile('owner') j`)
const j = r.rows[0]?.j
check('card', 'kartu publik bisa dibaca lewat link', j && j.slug === 'owner')
check('card', 'kartu publik tanpa role, tag internal, dan hak fitur', j && !('role' in j) && !('user_tag' in j) && !('feature_grants' in j))
r = await as('anon', null, `SELECT public.nfc_public_profile_by_owner($1) a, public.nfc_public_profile_by_id($2) b`, [U.owner, P_OWNER])
check('card', 'tap jam: profil pemilik terbaca lewat pemilik dan id', r.rows[0]?.a?.slug === 'owner' && r.rows[0]?.b?.slug === 'owner')
r = await as('anon', null, `SELECT public.nfc_public_profile('admin') j`)
check('card', 'tag internal admin tidak bocor', r.rows[0]?.j && !('user_tag' in r.rows[0].j) && !('role' in r.rows[0].j))

await q(`UPDATE public.profiles SET is_public = false WHERE user_id = $1`, [U.other])
r = await as('anon', null, `SELECT public.nfc_public_profile('other') j`)
check('private', 'kartu privat tidak terbaca publik', r.rows[0]?.j === null)
r = await as('authenticated', U.other, `SELECT public.nfc_public_profile('other') j`)
check('private', 'pemilik tetap bisa membuka kartu privatnya', r.rows[0]?.j?.slug === 'other')

r = await as('authenticated', U.owner, `INSERT INTO public.saved_profiles (user_id, profile_id) VALUES ($1, $2)`, [U.owner, P_OTHER])
check('saved', 'kartu privat tidak bisa disimpan orang lain', !!r.error)
await q(`UPDATE public.profiles SET is_public = true WHERE user_id = $1`, [U.other])
r = await as('authenticated', U.owner, `INSERT INTO public.saved_profiles (user_id, profile_id) VALUES ($1, $2)`, [U.owner, P_OTHER])
check('saved', 'kartu publik bisa disimpan', !r.error, r.error)
r = await as('authenticated', U.owner, `SELECT public.nfc_saved_profile_cards() j`)
check('saved', 'koleksi kartu tersimpan menampilkan ringkasan kartu orang lain', r.rows[0]?.j?.[0]?.profile?.slug === 'other' && !('email' in r.rows[0].j[0].profile))
r = await as('anon', null, `SELECT public.nfc_saved_profile_cards() j`)
check('saved', 'koleksi kartu butuh login', !!r.error)

r = await as('anon', null, `SELECT count(*)::int n FROM public.ai_concierge_settings`)
check('concierge', 'pengaturan concierge kartu publik tetap terbaca pengunjung', r.rows[0]?.n === 1)
r = await as('anon', null, `INSERT INTO public.ai_concierge_messages (profile_id, body) VALUES ($1, 'halo')`, [P_OWNER])
check('concierge', 'pengunjung tetap bisa kirim pesan concierge', !r.error, r.error)

r = await as('authenticated', U.other, `SELECT public.nfc_slug_available('owner') a, public.nfc_slug_available('other') b, public.nfc_slug_available('link-baru-dummy') c`)
check('slug', 'cek link: milik orang lain terpakai, milik sendiri dan link baru tersedia', r.rows[0]?.a === false && r.rows[0]?.b === true && r.rows[0]?.c === true)

r = await as('authenticated', U.owner, `UPDATE public.profiles SET bio = 'Bio baru dummy' WHERE user_id = $1`, [U.owner])
check('write', 'pemilik tetap bisa mengubah profilnya', r.count === 1)
r = await as('authenticated', U.fresh, `SELECT public.nfc_claim_serial($1) j`, [S(10)])
check('write', 'klaim kartu tetap jalan (profil dibuat server)', r.rows[0]?.j?.success === true, JSON.stringify(r))

await c.query(RB028)
r = await as('anon', null, `SELECT count(*)::int n FROM public.profiles`)
check('rollback', 'rollback membuka lagi baca publik (kondisi lama)', r.rows[0]?.n > 3)
await c.query(M028)
r = await as('anon', null, `SELECT count(*)::int n FROM public.profiles`)
check('rollback', 'migrasi 028 bisa diterapkan lagi', r.rows[0]?.n === 0)

await c.end(); await db.stop()
fs.rmSync(dataDir, { recursive: true, force: true })
const failed = results.filter((x) => !x.ok)
for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'} [${x.phase}] ${x.name}${x.note && !x.ok ? ' — ' + x.note : ''}`)
console.log(`\n${results.length - failed.length}/${results.length} lulus`)
process.exit(failed.length ? 1 : 0)
