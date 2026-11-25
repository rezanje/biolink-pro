// Uji 026 (kartu B2B ikut perusahaan, tema kartu perusahaan) di Postgres lokal, data dummy saja.
// Usage: NFC_PG_TOOLS=<folder dengan embedded-postgres dan pg terpasang> node supabase/tests/company-claim/run.mjs .
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
const RB026 = read('supabase/rollback/026_company_card_theme_rollback.sql')

const U = { owner: 'a0000000-0000-0000-0000-000000000001', other: 'a0000000-0000-0000-0000-000000000002', admin: 'a0000000-0000-0000-0000-000000000003',
  newbie: 'a0000000-0000-0000-0000-000000000006', fresh: 'a0000000-0000-0000-0000-000000000008', b2b: 'a0000000-0000-0000-0000-000000000009',
  promo: 'a0000000-0000-0000-0000-000000000010', late: 'a0000000-0000-0000-0000-000000000011' }
const S = (n) => `50000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`

const port = 54342
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
check('setup', 'migrasi 026 jalan di atas 025', true)

const CO_A = 'c0000000-0000-0000-0000-00000000000a', CO_B = 'c0000000-0000-0000-0000-00000000000b'
await q(`UPDATE public.serial_numbers SET company_id = $1 WHERE serial_uuid IN ($2, $3)`, [CO_A, S(14), S(15)])
await q(`UPDATE public.serial_numbers SET company_id = $1 WHERE serial_uuid = $2`, [CO_B, S(16)])

// Pendaftar baru klaim kartu perusahaan A
let r = await as('authenticated', U.promo, `SELECT public.nfc_claim_serial($1) j`, [S(14)])
let p = (await q(`SELECT company_id::text c, tier::text t FROM public.profiles WHERE user_id = $1`, [U.promo]))[0]
check('company', 'klaim kartu perusahaan: profil masuk perusahaan dan jadi B2B', r.rows[0]?.j?.success && p.c === CO_A && p.t === 'B2B', JSON.stringify(p))

// Anggota perusahaan A klaim kartu perusahaan B: tidak dipindah
r = await as('authenticated', U.promo, `SELECT public.nfc_claim_serial($1) j`, [S(16)])
p = (await q(`SELECT company_id::text c FROM public.profiles WHERE user_id = $1`, [U.promo]))[0]
check('company', 'profil yang sudah di perusahaan lain tidak dipindah', r.rows[0]?.j?.success && p.c === CO_A)

// Kartu personal: tidak ada perusahaan
r = await as('authenticated', U.late, `SELECT public.nfc_claim_serial($1) j`, [S(17)])
p = (await q(`SELECT company_id c, tier::text t FROM public.profiles WHERE user_id = $1`, [U.late]))[0]
check('company', 'kartu personal tidak memasukkan ke perusahaan', r.rows[0]?.j?.success && p.c === null && p.t !== 'B2B', JSON.stringify(p))

// Paket promo tidak menurunkan B2B
check('company', 'paket promo bawaan tidak menurunkan B2B', (await q(`SELECT tier::text t FROM public.profiles WHERE user_id = $1`, [U.promo]))[0].t === 'B2B')

// Tema perusahaan: hanya super admin yang bisa mengubah; publik bisa membaca
r = await as('authenticated', U.admin, `UPDATE public.companies SET card_template = 'cny' WHERE id = $1`, [CO_A])
check('theme', 'super admin memasang tema kartu perusahaan', r.count === 1, r.error)
r = await as('authenticated', U.promo, `UPDATE public.companies SET card_template = 'neon' WHERE id = $1`, [CO_A])
check('theme', 'anggota biasa tidak bisa mengubah tema perusahaan', r.error || r.count === 0)
r = await as('authenticated', 'a0000000-0000-0000-0000-000000000004', `UPDATE public.companies SET card_template = 'neon', logo_url = 'https://example.test/l.png' WHERE id = $1`, [CO_A])
check('theme', 'admin perusahaan bisa ubah data perusahaannya, tapi tidak temanya', r.count === 1 && (await q(`SELECT card_template t FROM public.companies WHERE id = $1`, [CO_A]))[0].t === 'cny', r.error)
r = await as('anon', null, `SELECT card_template FROM public.companies WHERE id = $1`, [CO_A])
check('theme', 'halaman publik bisa membaca tema perusahaan', r.rows[0]?.card_template === 'cny', r.error)
r = await as('authenticated', U.promo, `UPDATE public.profiles SET company_id = NULL WHERE user_id = $1`, [U.promo])
check('theme', 'anggota tidak bisa keluar dari perusahaan sendiri', !!r.error || (await q(`SELECT company_id::text c FROM public.profiles WHERE user_id = $1`, [U.promo]))[0].c === CO_A)

// Rollback
await c.query(RB026)
r = await as('authenticated', U.other, `SELECT public.nfc_claim_serial($1) j`, [S(15)])
p = (await q(`SELECT company_id c FROM public.profiles WHERE user_id = $1`, [U.other]))[0]
check('rollback', 'rollback: klaim kembali ke perilaku 025 (tanpa ikat perusahaan)', r.rows[0]?.j?.success && p.c === null, JSON.stringify(r))
await c.query(M026)
check('rollback', 'migrasi 026 bisa diterapkan lagi', true)

await c.end(); await db.stop()
fs.rmSync(dataDir, { recursive: true, force: true })
const failed = results.filter((x) => !x.ok)
for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'} [${x.phase}] ${x.name}${x.note && !x.ok ? ' — ' + x.note : ''}`)
console.log(`\n${results.length - failed.length}/${results.length} lulus`)
process.exit(failed.length ? 1 : 0)
