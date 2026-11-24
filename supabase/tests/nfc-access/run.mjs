// Uji aturan akses NFC di Postgres lokal, data dummy saja.
// Usage: NFC_PG_TOOLS=<folder dengan embedded-postgres dan pg terpasang> node supabase/tests/nfc-access/run.mjs .
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const here = path.dirname(new URL(import.meta.url).pathname)
const require = createRequire(path.join(process.env.NFC_PG_TOOLS || here, 'package.json'))
const EmbeddedPostgres = require('embedded-postgres').default
const pg = require('pg')

const repo = process.argv[2]
const MIG_A = fs.readFileSync(path.join(repo, 'supabase/migrations/023_nfc_public_functions.sql'), 'utf8')
const MIG = fs.readFileSync(path.join(repo, 'supabase/migrations/024_lock_nfc_data_access.sql'), 'utf8')
const SNAP = fs.readFileSync(path.join(repo, 'supabase/rollback/024_lock_nfc_data_access_snapshot.sql'), 'utf8')
const RB = fs.readFileSync(path.join(repo, 'supabase/rollback/024_lock_nfc_data_access_rollback.sql'), 'utf8')

const U = { owner: 'a0000000-0000-0000-0000-000000000001', other: 'a0000000-0000-0000-0000-000000000002', admin: 'a0000000-0000-0000-0000-000000000003',
  coadmin: 'a0000000-0000-0000-0000-000000000004', member: 'a0000000-0000-0000-0000-000000000005', newbie: 'a0000000-0000-0000-0000-000000000006', stale: 'a0000000-0000-0000-0000-000000000007' }
const S = (n) => `50000000-0000-0000-0000-00000000000${n}`
const CO_A = 'c0000000-0000-0000-0000-00000000000a', CO_B = 'c0000000-0000-0000-0000-00000000000b'

const db = new EmbeddedPostgres({ databaseDir: path.join(process.env.NFC_PG_DATA || '/tmp/nfc-access-pg'), user: 'postgres', password: 'postgres', port: 54339, persistent: false })
fs.rmSync(path.join(process.env.NFC_PG_DATA || '/tmp/nfc-access-pg'), { recursive: true, force: true })
await db.initialise(); await db.start(); await db.createDatabase('nfc')
const c = new pg.Client({ host: 'localhost', port: 54339, user: 'postgres', password: 'postgres', database: 'nfc' })
await c.connect()

// Jalankan sql sebagai peran tertentu. keep=false -> di-rollback (probe).
async function as(role, uid, sql, params = [], keep = false) {
  await c.query('BEGIN')
  try {
    await c.query(`SET LOCAL ROLE ${role}`)
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid || ''])
    const r = await c.query(sql, params)
    await c.query(keep ? 'COMMIT' : 'ROLLBACK')
    return { rows: r.rows, count: r.rowCount }
  } catch (e) { await c.query('ROLLBACK'); return { error: e.message, rows: [], count: 0 } }
}

const results = []
function check(phase, name, ok, note = '') { results.push({ phase, name, ok: !!ok, note }); }

await c.query(fs.readFileSync(path.join(here, 'fixture.sql'), 'utf8'))

// ---------------- SEBELUM perbaikan: celah harus terbukti ada ----------------
let r
r = await as('anon', null, 'SELECT count(*)::int n FROM public.serial_numbers WHERE gift_token IS NOT NULL')
check('before', 'pengunjung bisa membaca token kado', r.rows[0]?.n > 0)
r = await as('anon', null, `UPDATE public.serial_numbers SET owner_id = $1 WHERE serial_uuid = $2`, [U.other, S(1)])
check('before', 'pengunjung bisa mengubah pemilik nomor seri', r.count === 1)
r = await as('anon', null, `DELETE FROM public.serial_numbers WHERE serial_uuid = $1`, [S(3)])
check('before', 'pengunjung bisa menghapus nomor seri', r.count === 1)
r = await as('authenticated', U.owner, `UPDATE public.profiles SET role = 'super_admin' WHERE user_id = $1`, [U.owner])
check('before', 'pengguna bisa menjadikan dirinya super admin', r.count === 1)
r = await as('anon', null, `UPDATE public.companies SET name = 'x' WHERE id = $1`, [CO_B])
check('before', 'pengunjung bisa mengubah data perusahaan', r.count === 1)
r = await as('anon', null, `SELECT public.claim_serial_number($1, $2) j`, [S(3), U.other])
check('before', 'pengunjung bisa memanggil klaim lama untuk user lain', r.rows[0]?.j?.success === true)

// ---------------- Bagian A saja: kode lama DAN kode baru sama-sama jalan ----------------
await c.query(MIG_A); await c.query(MIG_A)
r = await as('anon', null, 'SELECT serial_uuid FROM public.serial_numbers WHERE serial_uuid = $1', [S(1)])
const oldOk = r.rows.length === 1
r = await as('anon', null, `SELECT public.nfc_get_serial($1) j`, [S(1)])
check('order', 'setelah bagian A: kode lama dan kode baru sama-sama bisa membaca kartu', oldOk && r.rows[0]?.j?.serial_uuid === S(1))

// ---------------- Terapkan bagian B ----------------
const snap = (await c.query(SNAP)).rows[0].restore_sql
const policiesBefore = (await c.query(`SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('serial_numbers','companies') ORDER BY 1,2`)).rows
await c.query(MIG)
await c.query(MIG) // harus aman dijalankan dua kali
check('apply', 'migrasi jalan dan aman diulang', true)

// ---------------- SESUDAH: celah tertutup ----------------
r = await as('anon', null, 'SELECT count(*)::int n FROM public.serial_numbers')
check('after', 'pengunjung tidak bisa membaca tabel nomor seri', r.error || r.rows[0]?.n === 0, r.error ? 'ditolak' : '0 baris')
r = await as('authenticated', U.other, 'SELECT count(*)::int n FROM public.serial_numbers WHERE gift_token IS NOT NULL')
check('after', 'pengguna lain tidak bisa membaca token kado', r.rows[0]?.n === 0)
r = await as('anon', null, `UPDATE public.serial_numbers SET owner_id = $1 WHERE serial_uuid = $2`, [U.other, S(1)])
check('after', 'pengunjung tidak bisa mengubah nomor seri', r.error || r.count === 0)
r = await as('authenticated', U.other, `UPDATE public.serial_numbers SET owner_id = $1 WHERE serial_uuid = $2`, [U.other, S(1)])
check('after', 'pengguna lain tidak bisa mengubah nomor seri orang', r.error || r.count === 0)
r = await as('anon', null, `DELETE FROM public.serial_numbers WHERE serial_uuid = $1`, [S(3)])
check('after', 'pengunjung tidak bisa menghapus nomor seri', r.error || r.count === 0)
r = await as('authenticated', U.owner, `UPDATE public.profiles SET role = 'super_admin' WHERE user_id = $1`, [U.owner])
check('after', 'pengguna tidak bisa menjadikan dirinya super admin', r.error)
r = await as('authenticated', U.owner, `UPDATE public.profiles SET company_id = $2 WHERE user_id = $1`, [U.owner, CO_A])
check('after', 'pengguna tidak bisa memasukkan dirinya ke perusahaan', r.error)
r = await as('authenticated', U.coadmin, `UPDATE public.profiles SET role = 'super_admin' WHERE user_id = $1`, [U.coadmin])
check('after', 'admin perusahaan tidak bisa naik jadi super admin', r.error)
r = await as('anon', null, `UPDATE public.companies SET name = 'x' WHERE id = $1`, [CO_B])
check('after', 'pengunjung tidak bisa mengubah perusahaan', r.error || r.count === 0)
r = await as('anon', null, `DELETE FROM public.companies WHERE id = $1`, [CO_B])
check('after', 'pengunjung tidak bisa menghapus perusahaan', r.error || r.count === 0)
r = await as('anon', null, `SELECT public.claim_serial_number($1, $2) j`, [S(3), U.other])
check('after', 'pengunjung tidak bisa memanggil klaim lama', r.error)
r = await as('anon', null, `SELECT public.nfc_get_serial($1) j`, [S(2)])
check('after', 'data kartu publik tidak memuat token kado', r.rows[0]?.j && !('gift_token' in r.rows[0].j))
r = await as('anon', null, `SELECT public.nfc_claim_serial($1, $2) j`, [S(6), U.stale])
check('after', 'klaim tanpa login ditolak untuk akun lama', r.rows[0]?.j?.success === false)
r = await as('anon', null, `SELECT public.nfc_claim_serial($1, $2) j`, [S(1), U.newbie])
check('after', 'akun baru tidak bisa merebut kartu yang sudah dimiliki', r.rows[0]?.j?.success === false)
r = await as('authenticated', U.other, `SELECT public.nfc_claim_serial($1) j`, [S(1)])
check('after', 'pengguna lain tidak bisa merebut kartu milik orang', r.rows[0]?.j?.success === false)
r = await as('anon', null, `SELECT public.nfc_save_gift('', 'https://evil.test', 'x', 'x') j`)
check('after', 'simpan kado tanpa token ditolak', r.rows[0]?.j?.success === false)

// ---------------- SESUDAH: alur pelanggan tetap jalan ----------------
r = await as('anon', null, `SELECT public.nfc_get_serial($1) j`, [S(1)])
const tapped = r.rows[0]?.j
check('flow', 'tap kartu publik: data kartu + produk terbaca', tapped?.serial_uuid === S(1) && tapped?.products?.name === 'Dummy Watch' && tapped?.owner_id === U.owner)
r = await as('anon', null, `SELECT slug, email FROM public.profiles WHERE user_id = $1`, [U.owner])
check('flow', 'tap kartu publik: profil pemilik + kontak yang dibagikan tetap tampil', r.rows[0]?.slug === 'owner' && r.rows[0]?.email)
r = await as('anon', null, `SELECT public.nfc_get_serial('00000000-0000-0000-0000-000000000000') j`)
check('flow', 'kartu tak terdaftar tetap "tidak ditemukan"', r.rows[0]?.j === null)
r = await as('anon', null, `SELECT public.increment_tap_count($1)`, [S(1)], true)
r = await c.query('SELECT nfc_tap_count FROM public.serial_numbers WHERE serial_uuid = $1', [S(1)])
check('flow', 'penghitung tap tetap bertambah', r.rows[0].nfc_tap_count === 1)
r = await as('anon', null, `SELECT name FROM public.companies WHERE id = $1`, [CO_A])
check('flow', 'branding perusahaan tetap terbaca publik', r.rows[0]?.name === 'Dummy Co A')
// Kado
r = await as('anon', null, `SELECT public.nfc_get_gift_by_token($1) j`, ['dummygifttoken0005'])
check('flow', 'pembeli membuka halaman isian kado dengan token', r.rows[0]?.j?.serial_uuid === S(5))
r = await as('anon', null, `SELECT public.nfc_save_gift($1, $2, $3, $4) j`, ['dummygifttoken0005', ' https://example.test/v ', ' Halo ', ' Budi '], true)
check('flow', 'pembeli menyimpan isian kado', r.rows[0]?.j?.success === true)
r = await as('anon', null, `SELECT public.nfc_get_serial($1) j`, [S(5)])
check('flow', 'penerima melihat isi kado di kartu (kado)', r.rows[0]?.j?.gift_enabled === true && r.rows[0]?.j?.gift_url === 'https://example.test/v' && r.rows[0]?.j?.gift_message === 'Halo')
await as('anon', null, `SELECT public.nfc_mark_gift_opened($1)`, [S(5)], true)
r = await c.query('SELECT gift_opened_at FROM public.serial_numbers WHERE serial_uuid = $1', [S(5)])
check('flow', 'kado tercatat sudah dibuka saat tap pertama', r.rows[0].gift_opened_at)
r = await as('anon', null, `SELECT public.nfc_save_gift($1, 'https://example.test/changed', 'x', 'x') j`, ['dummygifttoken0005'])
check('flow', 'kado yang sudah dibuka terkunci', r.rows[0]?.j?.success === false)
r = await as('anon', null, `SELECT public.nfc_mark_gift_opened($1)`, [S(3)], true)
r = await c.query('SELECT gift_opened_at FROM public.serial_numbers WHERE serial_uuid = $1', [S(3)])
check('flow', 'kartu tanpa kado tidak ditandai dibuka', r.rows[0].gift_opened_at === null)
// Klaim / aktivasi
r = await as('authenticated', U.other, `SELECT public.nfc_claim_serial($1) j`, [S(3)], true)
check('flow', 'aktivasi kartu oleh pengguna login (Google/email lama)', r.rows[0]?.j?.success === true)
r = await as('authenticated', U.other, `SELECT public.nfc_claim_serial($1) j`, [S(3)])
check('flow', 'aktivasi ulang kartu sendiri tetap berhasil', r.rows[0]?.j?.success === true)
r = await as('anon', null, `SELECT public.nfc_claim_serial($1, $2) j`, [S(6), U.newbie], true)
check('flow', 'aktivasi oleh pendaftar email baru (belum konfirmasi)', r.rows[0]?.j?.success === true)
r = await as('authenticated', U.newbie, `INSERT INTO public.profiles (user_id, slug, display_name, email, tier) VALUES ($1, 'newbie-1', 'newbie', 'newbie@example.test', 'PREMIUM')`, [U.newbie], true)
check('flow', 'profil baru dengan trial PREMIUM tetap bisa dibuat', !r.error, r.error || '')
r = await as('authenticated', U.newbie, `INSERT INTO public.profiles (user_id, slug, display_name, email, tier) VALUES ($1, 'newbie-2', 'n', 'n@example.test', 'PREMIUM') ON CONFLICT (user_id) DO UPDATE SET slug = EXCLUDED.slug, tier = EXCLUDED.tier`, [U.newbie])
check('flow', 'upsert profil saat klaim tetap jalan', !r.error, r.error || '')
r = await as('authenticated', U.other, `SELECT public.claim_serial_number($1, $2) j`, [S(2), U.other])
check('flow', 'klaim lama via API (login) tetap jalan', r.rows[0]?.j?.success === true)
// Dashboard pemilik
r = await as('authenticated', U.owner, `SELECT serial_uuid FROM public.serial_numbers WHERE owner_id = $1`, [U.owner])
check('flow', 'pemilik melihat kartunya di dashboard', r.rows.length === 1)
r = await as('authenticated', U.owner, `UPDATE public.profiles SET display_name = 'Owner Baru', bio = 'b', email = 'kontak@example.test' WHERE user_id = $1`, [U.owner])
check('flow', 'pemilik mengedit profilnya', r.count === 1)
r = await as('authenticated', U.owner, `SELECT special_edition FROM public.serial_numbers WHERE serial_uuid = $1`, [S(1)])
check('flow', 'pemilik membaca edisi spesial kartunya (setelah klaim)', r.rows.length === 1)
// Super admin
r = await as('authenticated', U.admin, `SELECT count(*)::int n FROM public.serial_numbers`)
check('flow', 'super admin melihat semua nomor seri', r.rows[0]?.n === 6)
r = await as('authenticated', U.admin, `UPDATE public.serial_numbers SET gift_token = 'newdummytoken', sync_enabled = false WHERE serial_uuid = $1`, [S(4)])
check('flow', 'super admin mengubah kado/sync nomor seri', r.count === 1)
r = await as('authenticated', U.admin, `INSERT INTO public.serial_numbers (product_id) VALUES ('d0000000-0000-0000-0000-000000000001')`)
check('flow', 'super admin membuat nomor seri', !r.error, r.error || '')
r = await as('authenticated', U.admin, `DELETE FROM public.serial_numbers WHERE serial_uuid = $1`, [S(3)])
check('flow', 'super admin menghapus nomor seri', r.count === 1)
r = await as('authenticated', U.admin, `UPDATE public.profiles SET role = 'company_admin', company_id = $2 WHERE user_id = $1`, [U.other, CO_B])
check('flow', 'super admin mengatur peran & perusahaan pengguna', r.count === 1)
r = await as('authenticated', U.admin, `UPDATE public.companies SET name = 'Dummy Co B2' WHERE id = $1`, [CO_B])
check('flow', 'super admin mengubah perusahaan', r.count === 1)
r = await as('authenticated', U.admin, `INSERT INTO public.companies (name) VALUES ('Dummy Co C')`)
check('flow', 'super admin menambah perusahaan', !r.error, r.error || '')
// Admin & anggota perusahaan
r = await as('authenticated', U.coadmin, `SELECT serial_uuid FROM public.serial_numbers WHERE owner_id = ANY($1::uuid[])`, [[U.member, U.coadmin]])
check('flow', 'admin perusahaan melihat aset anggota', r.rows.length === 1)
r = await as('authenticated', U.coadmin, `UPDATE public.serial_numbers SET sync_enabled = false WHERE serial_uuid = $1`, [S(4)])
check('flow', 'admin perusahaan mengatur kartu anggota', r.count === 1)
r = await as('authenticated', U.coadmin, `UPDATE public.serial_numbers SET sync_enabled = false WHERE serial_uuid = $1`, [S(1)])
check('flow', 'admin perusahaan tidak bisa mengubah kartu di luar perusahaannya', r.error || r.count === 0)
r = await as('authenticated', U.coadmin, `UPDATE public.companies SET logo_url = 'https://example.test/logo.png' WHERE id = $1`, [CO_A])
check('flow', 'admin perusahaan mengubah pengaturan perusahaannya', r.count === 1)
r = await as('authenticated', U.coadmin, `UPDATE public.companies SET name = 'x' WHERE id = $1`, [CO_B])
check('flow', 'admin perusahaan tidak bisa mengubah perusahaan lain', r.error || r.count === 0)
r = await as('authenticated', U.member, `SELECT nfc_tap_count FROM public.serial_numbers WHERE owner_id = ANY($1::uuid[])`, [[U.member, U.coadmin]])
check('flow', 'anggota perusahaan melihat analitik tap timnya', r.rows.length === 1)
r = await as('service_role', null, `UPDATE public.profiles SET role = 'company_admin' WHERE user_id = $1`, [U.member])
check('flow', 'API admin di server (service role) tetap bisa mengubah peran', r.count === 1)

// ---------------- Rollback ----------------
await c.query(RB)
await c.query(snap)
const policiesAfterRollback = (await c.query(`SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('serial_numbers','companies') ORDER BY 1,2`)).rows
const trig = (await c.query(`SELECT count(*)::int n FROM pg_trigger WHERE tgname = 'nfc_guard_profile_privileges'`)).rows[0].n
r = await as('anon', null, `SELECT public.claim_serial_number($1, $2) j`, [S(6), U.other])
check('rollback', 'rollback mengembalikan aturan lama persis', JSON.stringify(policiesBefore) === JSON.stringify(policiesAfterRollback) && trig === 0 && !r.error)
await c.query(MIG)
check('rollback', 'migrasi bisa diterapkan lagi setelah rollback', true)

await c.end(); await db.stop()
const failed = results.filter((x) => !x.ok)
for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'} [${x.phase}] ${x.name}${x.note && !x.ok ? ' — ' + x.note : ''}`)
console.log(`\n${results.length - failed.length}/${results.length} lulus`)
process.exit(failed.length ? 1 : 0)
