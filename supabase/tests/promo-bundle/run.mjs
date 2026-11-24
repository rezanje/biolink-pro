// Uji 025 (paket promo, bundel, kunci tier, kado) di Postgres lokal, data dummy saja.
// Usage: NFC_PG_TOOLS=<folder dengan embedded-postgres dan pg terpasang> node supabase/tests/promo-bundle/run.mjs .
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
const RB025 = read('supabase/rollback/025_promo_bundle_entitlements_rollback.sql')

const U = { owner: 'a0000000-0000-0000-0000-000000000001', other: 'a0000000-0000-0000-0000-000000000002', admin: 'a0000000-0000-0000-0000-000000000003',
  newbie: 'a0000000-0000-0000-0000-000000000006', fresh: 'a0000000-0000-0000-0000-000000000008', b2b: 'a0000000-0000-0000-0000-000000000009',
  promo: 'a0000000-0000-0000-0000-000000000010', late: 'a0000000-0000-0000-0000-000000000011' }
const S = (n) => `50000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`

const port = 54341
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
  ALTER TABLE public.ownership_logs ADD COLUMN transferred_at timestamptz DEFAULT now();
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
   ('${S(10)}', 'd0000000-0000-0000-0000-000000000001', '{}'), ('${S(11)}', 'd0000000-0000-0000-0000-000000000001', '{}'),
   ('${S(12)}', 'd0000000-0000-0000-0000-000000000001', '{aruna}'), ('${S(13)}', 'd0000000-0000-0000-0000-000000000001', '{}'),
   ('${S(14)}', 'd0000000-0000-0000-0000-000000000001', '{}'), ('${S(15)}', 'd0000000-0000-0000-0000-000000000001', '{}'),
   ('${S(16)}', 'd0000000-0000-0000-0000-000000000001', '{}'), ('${S(17)}', 'd0000000-0000-0000-0000-000000000001', '{}');
`)
await c.query(M023)
await c.query(M024)
await c.query(M025)
check('setup', 'migrasi 025 jalan di atas 023 + 024', true)

// ---------- Kunci tier ----------
let r = await as('authenticated', U.owner, `UPDATE public.profiles SET tier = 'PREMIUM', subscription_valid_until = now() + interval '99 years', unlocked_templates = '{neon}', feature_grants = '{ai_bot}', special_editions = '{aruna}' WHERE user_id = $1`, [U.owner])
let p = await prof(U.owner)
check('tier', 'pemilik tidak bisa menaikkan tier/masa berlaku/template/fitur/edisi sendiri', !r.error && p.tier === 'FREE' && !p.v && p.t.length === 0 && p.f.length === 0 && (p.e || []).length === 0, JSON.stringify(p))
r = await as('authenticated', U.owner, `UPDATE public.profiles SET display_name = 'Owner Edit', bio = 'Bio lama owner' WHERE user_id = $1`, [U.owner])
check('tier', 'pemilik tetap bisa mengedit nama dan bio', r.count === 1 && (await prof(U.owner)).display_name === 'Owner Edit')
r = await as('authenticated', U.late, `INSERT INTO public.profiles (user_id, slug, display_name, tier, subscription_valid_until) VALUES ($1, 'late-dummy', 'Late', 'PREMIUM', now() + interval '1 year')`, [U.late])
p = await prof(U.late)
check('tier', 'profil baru dari browser selalu FREE', !r.error && p.tier === 'FREE' && !p.v, r.error || JSON.stringify(p))
await q(`DELETE FROM public.profiles WHERE user_id = $1`, [U.late])
r = await as('authenticated', U.owner, `UPDATE public.tier_configs SET features = '{"sync": true}' WHERE tier = 'FREE'`)
check('tier', 'pengguna biasa tidak bisa mengubah tabel fitur per tier', r.error || r.count === 0)
r = await as('anon', null, `UPDATE public.tier_configs SET features = '{}' WHERE tier = 'FREE'`)
check('tier', 'pengunjung tanpa login tidak bisa mengubah tabel fitur per tier', r.error || r.count === 0)
r = await as('authenticated', U.admin, `UPDATE public.tier_configs SET features = '{"sync": false, "x": true}' WHERE tier = 'FREE'`)
check('tier', 'super admin bisa mengubah tabel fitur per tier', r.count === 1)
r = await as('authenticated', U.admin, `UPDATE public.profiles SET tier = 'PREMIUM', subscription_valid_until = NULL WHERE user_id = $1`, [U.other])
check('tier', 'super admin bisa mengatur tier pelanggan langsung', r.count === 1 && (await prof(U.other)).tier === 'PREMIUM')
r = await as('service_role', null, `UPDATE public.profiles SET tier = 'FREE' WHERE user_id = $1`, [U.other])
check('tier', 'server (service role) tetap bisa mengatur tier', r.count === 1 && (await prof(U.other)).tier === 'FREE')

// ---------- Slug ----------
r = await as('authenticated', U.owner, `UPDATE public.profiles SET slug = 'owner-baru' WHERE user_id = $1`, [U.owner])
check('slug', 'pengguna FREE tidak bisa mengganti link', !!r.error && (await prof(U.owner)).slug === 'owner', r.error)
await q(`UPDATE public.profiles SET tier = 'PREMIUM', subscription_valid_until = now() + interval '5 days' WHERE user_id = $1`, [U.owner])
r = await as('authenticated', U.owner, `UPDATE public.profiles SET slug = 'admin' WHERE user_id = $1`, [U.owner])
check('slug', 'nama yang dicadangkan ditolak (admin)', !!r.error)
r = await as('authenticated', U.owner, `UPDATE public.profiles SET slug = 'gentanala-official' WHERE user_id = $1`, [U.owner])
check('slug', 'nama yang dicadangkan ditolak (gentanala-…)', !!r.error)
r = await as('authenticated', U.owner, `UPDATE public.profiles SET slug = 'ab' WHERE user_id = $1`, [U.owner])
check('slug', 'link terlalu pendek ditolak', !!r.error)
r = await as('authenticated', U.owner, `UPDATE public.profiles SET slug = 'owner-baru' WHERE user_id = $1`, [U.owner])
check('slug', 'pengguna Premium bisa mengganti link', r.count === 1 && (await prof(U.owner)).slug === 'owner-baru', r.error)
r = await as('anon', null, `SELECT public.nfc_resolve_old_slug('owner') s`)
check('slug', 'link lama diarahkan ke link baru', r.rows[0]?.s === 'owner-baru', JSON.stringify(r))
r = await as('authenticated', U.owner, `UPDATE public.profiles SET slug = 'owner-ketiga' WHERE user_id = $1`, [U.owner])
r = await as('anon', null, `SELECT public.nfc_resolve_old_slug('owner') a, public.nfc_resolve_old_slug('owner-baru') b`)
check('slug', 'semua link lama mengarah ke link terbaru', r.rows[0]?.a === 'owner-ketiga' && r.rows[0]?.b === 'owner-ketiga')
r = await as('anon', null, `SELECT count(*)::int n FROM public.profile_slug_history`)
check('slug', 'riwayat link tidak bisa dibaca langsung publik', !!r.error)
await q(`UPDATE public.profiles SET tier = 'FREE', subscription_valid_until = NULL WHERE user_id = $1`, [U.owner])

// ---------- Paket promo: akses ----------
r = await as('authenticated', U.owner, `SELECT count(*)::int n FROM public.promo_packages`)
check('promo', 'pengguna biasa tidak melihat paket promo', !r.error && r.rows[0].n === 0)
r = await as('authenticated', U.owner, `INSERT INTO public.promo_packages (name, is_active, applies_to_all, premium_mode) VALUES ('Hack', true, true, 'unlimited')`)
check('promo', 'pengguna biasa tidak bisa membuat paket', !!r.error)
r = await as('anon', null, `SELECT count(*)::int n FROM public.promo_packages`)
check('promo', 'pengunjung tanpa login tidak bisa membaca paket', !!r.error || r.rows[0]?.n === 0)
r = await as('authenticated', U.admin, `SELECT name, premium_days FROM public.promo_packages`)
check('promo', 'paket bawaan "Trial standar" 30 hari sudah ada', r.rows.length === 1 && r.rows[0].premium_days === 30)
r = await as('authenticated', U.admin, `INSERT INTO public.promo_packages (name, is_active, premium_mode, templates, features) VALUES ('Promo Awal (dummy)', true, 'unlimited', '{neon}', '{analytics_leads}') RETURNING id`)
const PROMO = r.rows[0]?.id
check('promo', 'super admin bisa membuat paket promo', !!PROMO, r.error)

// ---------- Klaim + paket ----------
// Pendaftar email baru (belum konfirmasi): profil dibuat server, trial standar.
r = await as('anon', null, `SELECT public.nfc_claim_serial($1, $2) j`, [S(3), U.newbie])
p = await prof(U.newbie)
check('claim', 'pendaftar baru: klaim membuat profil + Premium 30 hari dari paket bawaan', r.rows[0]?.j?.success && p && p.tier === 'PREMIUM' && days(p.v) === 30, JSON.stringify(r.rows[0]?.j) + JSON.stringify(p))
// Pengguna lama (session) klaim perangkat kedua: profil tidak tertimpa.
r = await as('authenticated', U.owner, `SELECT public.nfc_claim_serial($1) j`, [S(6)])
p = await prof(U.owner)
check('claim', 'klaim perangkat kedua tidak menimpa link, nama, dan bio lama', r.rows[0]?.j?.success && p.slug === 'owner-ketiga' && p.bio === 'Bio lama owner' && p.display_name === 'Owner Edit', JSON.stringify(p))
check('claim', 'klaim perangkat kedua tetap dapat hak paket', p.tier === 'PREMIUM' && days(p.v) === 30)
// Akun Google baru (sudah login, belum punya profil): nama dari Google.
await q(`UPDATE public.serial_numbers SET promo_package_id = $1 WHERE serial_uuid = $2`, [PROMO, S(12)])
r = await as('authenticated', U.fresh, `SELECT public.nfc_claim_serial($1) j`, [S(12)])
p = await prof(U.fresh)
check('claim', 'akun baru: profil dibuat dengan nama akun dan link rapi', p && p.display_name === 'Rani Dummy' && /^raniputri-\d{4}$/.test(p.slug), JSON.stringify(p))
check('claim', 'paket khusus seri: Premium tanpa batas + template Neon + fitur tambahan', p.tier === 'PREMIUM' && p.v === null && p.t.includes('neon') && p.f.includes('analytics_leads'), JSON.stringify(p))
check('claim', 'edisi spesial seri ikut ke profil', (p.e || []).includes('aruna'))
r = await as('authenticated', U.fresh, `SELECT count(*)::int n FROM public.promo_grants WHERE user_id = $1`, [U.fresh])
check('claim', 'pemilik bisa melihat catatan hak promonya', r.rows[0]?.n === 1)
// Klaim ulang seri sendiri tidak memberi hak dua kali.
r = await as('authenticated', U.fresh, `SELECT public.nfc_claim_serial($1) j`, [S(12)])
const grants = await q(`SELECT count(*)::int n FROM public.promo_grants WHERE user_id = $1`, [U.fresh])
check('claim', 'klaim ulang seri sendiri tidak memberi hak dua kali', r.rows[0]?.j?.success && grants[0].n === 1)
// B2B tidak turun jadi PREMIUM.
r = await as('authenticated', U.b2b, `SELECT public.nfc_claim_serial($1) j`, [S(13)])
check('claim', 'pelanggan B2B tetap B2B setelah klaim', (await prof(U.b2b)).tier === 'B2B')
// Seri milik orang lain tetap tidak bisa direbut.
r = await as('authenticated', U.other, `SELECT public.nfc_claim_serial($1) j`, [S(12)])
check('claim', 'seri milik orang lain tidak bisa diklaim', r.rows[0]?.j?.success === false)

// ---------- Paket dimatikan ----------
await as('authenticated', U.admin, `UPDATE public.promo_packages SET is_active = false WHERE id = $1`, [PROMO])
p = await prof(U.fresh)
check('promo-off', 'mematikan paket tidak mencabut hak yang sudah diberikan', p.tier === 'PREMIUM' && p.v === null && p.t.includes('neon'))
await q(`UPDATE public.serial_numbers SET promo_package_id = $1 WHERE serial_uuid = $2`, [PROMO, S(14)])
r = await as('authenticated', U.promo, `SELECT public.nfc_claim_serial($1) j`, [S(14)])
p = await prof(U.promo)
check('promo-off', 'paket mati: klaim baru jatuh ke paket bawaan, tanpa Neon', p.tier === 'PREMIUM' && days(p.v) === 30 && !p.t.includes('neon'), JSON.stringify(p))
await as('authenticated', U.admin, `UPDATE public.promo_packages SET is_active = true, ends_at = now() - interval '1 minute', starts_at = now() - interval '2 days' WHERE id = $1`, [PROMO])
check('promo-off', 'paket di luar periode tidak dipakai', (await q(`SELECT public.nfc_promo_for_serial(id) = $1 AS hit FROM public.serial_numbers WHERE serial_uuid = $2`, [PROMO, S(14)]))[0].hit === false)

// ---------- Bundel ----------
r = await as('authenticated', U.owner, `SELECT public.nfc_admin_set_bundle(ARRAY(SELECT id FROM public.serial_numbers WHERE serial_uuid IN ($1, $2)), true) j`, [S(10), S(11)])
check('bundle', 'pengguna biasa tidak bisa memasangkan bundel', r.rows[0]?.j?.success === false)
r = await as('authenticated', U.admin, `SELECT public.nfc_admin_set_bundle(ARRAY(SELECT id FROM public.serial_numbers WHERE serial_uuid IN ($1)), true) j`, [S(10)])
check('bundle', 'bundel butuh minimal 2 seri', r.rows[0]?.j?.success === false)
r = await as('authenticated', U.admin, `SELECT public.nfc_admin_set_bundle(ARRAY(SELECT id FROM public.serial_numbers WHERE serial_uuid IN ($1, $2)), true) j`, [S(10), S(11)])
check('bundle', 'super admin memasangkan jam + kartu jadi satu bundel', r.rows[0]?.j?.success && r.rows[0].j.count === 2)
r = await as('anon', null, `SELECT public.nfc_claim_serial($1, $2) j`, [S(11), U.newbie])
const bundle = await q(`SELECT serial_uuid::text u, owner_id::text o, is_claimed FROM public.serial_numbers WHERE serial_uuid IN ($1, $2)`, [S(10), S(11)])
check('bundle', 'sekali aktivasi di salah satu: dua-duanya jadi milik orang yang sama', r.rows[0]?.j?.success && r.rows[0].j.bundle_claimed === 1 && bundle.every(b => b.o === U.newbie && b.is_claimed), JSON.stringify(r.rows[0]?.j))
const logs = await q(`SELECT count(*)::int n FROM public.ownership_logs WHERE to_user_id = $1`, [U.newbie])
check('bundle', 'riwayat kepemilikan tercatat untuk kedua perangkat', logs[0].n === 3)
const ng = await q(`SELECT count(*)::int n FROM public.promo_grants WHERE user_id = $1`, [U.newbie])
check('bundle', 'hak paket diberikan sekali per bundel, bukan per perangkat', ng[0].n === 2) // 1 dari S3, 1 dari bundel
r = await as('anon', null, `SELECT public.nfc_get_serial($1) j`, [S(10)])
check('bundle', 'tap perangkat pasangan langsung menampilkan pemilik yang sama', r.rows[0]?.j?.owner_id === U.newbie && r.rows[0]?.j?.is_claimed === true)
r = await as('authenticated', U.admin, `SELECT public.nfc_admin_set_bundle(ARRAY(SELECT id FROM public.serial_numbers WHERE serial_uuid IN ($1, $2)), true) j`, [S(10), S(13)])
check('bundle', 'tidak bisa membundel seri milik dua orang berbeda', r.rows[0]?.j?.success === false)
r = await as('authenticated', U.admin, `SELECT public.nfc_admin_set_bundle(ARRAY(SELECT id FROM public.serial_numbers WHERE serial_uuid IN ($1, $2)), false) j`, [S(10), S(11)])
check('bundle', 'super admin bisa melepas bundel', r.rows[0]?.j?.success && (await q(`SELECT count(*)::int n FROM public.serial_numbers WHERE bundle_id IS NOT NULL`))[0].n === 0)

// ---------- Kado ----------
await q(`UPDATE public.serial_numbers SET gift_token = 'dummygift16' WHERE serial_uuid = $1`, [S(16)])
r = await as('anon', null, `SELECT public.nfc_save_gift('dummygift16', '', '', 'Budi') j`)
check('gift', 'kado kosong (tanpa link dan ucapan) ditolak', r.rows[0]?.j?.success === false)
r = await as('anon', null, `SELECT public.nfc_save_gift('dummygift16', '', 'Selamat ulang tahun!', 'Budi') j`)
check('gift', 'kado ucapan saja (tanpa link) bisa disimpan', r.rows[0]?.j?.success === true)
r = await as('anon', null, `SELECT public.nfc_get_serial($1) j`, [S(16)])
const g = r.rows[0]?.j
check('gift', 'halaman tap tidak membocorkan token kado', g && !('gift_token' in g) && g.gift_enabled && g.gift_message === 'Selamat ulang tahun!')
r = await as('anon', null, `SELECT public.nfc_save_gift('salah-token', 'https://youtu.be/x', 'x', 'x') j`)
check('gift', 'token kado salah ditolak', r.rows[0]?.j?.success === false)
await as('anon', null, `SELECT public.nfc_mark_gift_opened($1)`, [S(16)])
check('gift', 'kado ucapan saja ditandai terbuka saat tap pertama', !!(await q(`SELECT gift_opened_at FROM public.serial_numbers WHERE serial_uuid = $1`, [S(16)]))[0].gift_opened_at)
r = await as('anon', null, `SELECT public.nfc_save_gift('dummygift16', 'https://youtu.be/abc', 'Ganti', 'Budi') j`)
check('gift', 'isi kado dikunci setelah dibuka penerima', r.rows[0]?.j?.success === false)
r = await as('anon', null, `SELECT public.nfc_claim_serial($1, $2) j`, [S(16), U.fresh])
check('gift', 'penerima kado tetap perlu login untuk aktivasi (akun lama tidak bisa lewat jalur tanpa login)', r.rows[0]?.j?.success === false)
r = await as('authenticated', U.late, `SELECT public.nfc_claim_serial($1) j`, [S(16)])
p = await prof(U.late)
check('gift', 'penerima kado aktivasi setelah melihat kejutan: profil dibuat', r.rows[0]?.j?.success && !!p)

// ---------- Rollback ----------
await c.query(RB025)
r = await as('authenticated', U.other, `SELECT public.nfc_claim_serial($1) j`, [S(15)])
check('rollback', 'rollback: klaim versi 023 jalan lagi', r.rows[0]?.j?.success === true, JSON.stringify(r))
await c.query(M025)
check('rollback', 'migrasi 025 bisa diterapkan lagi setelah rollback', true)
r = await as('authenticated', U.other, `UPDATE public.profiles SET tier = 'B2B' WHERE user_id = $1`, [U.other])
check('rollback', 'setelah diterapkan lagi, kunci tier aktif kembali', (await prof(U.other)).tier === 'FREE')

await c.end(); await db.stop()
fs.rmSync(dataDir, { recursive: true, force: true })
const failed = results.filter((x) => !x.ok)
for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'} [${x.phase}] ${x.name}${x.note && !x.ok ? ' — ' + x.note : ''}`)
console.log(`\n${results.length - failed.length}/${results.length} lulus`)
process.exit(failed.length ? 1 : 0)
