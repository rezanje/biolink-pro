# Rilis: penutupan akses data NFC (audit 23 Nov 2026, P0)

## Apa yang berubah

| Sebelum | Sesudah |
|---|---|
| Kunci publik situs bisa membaca semua nomor seri, termasuk token kado | Tabel nomor seri hanya terbaca oleh pemilik, anggota perusahaannya, dan super admin. Halaman publik memakai fungsi yang tidak pernah mengembalikan token kado |
| Siapa saja bisa mengubah atau menghapus nomor seri | Hanya super admin, dan admin perusahaan untuk kartu anggotanya |
| Pengguna bisa mengubah perannya sendiri jadi super admin | Peran dan perusahaan di profil hanya bisa diubah super admin atau API admin di server |
| Siapa saja bisa mengubah atau menghapus data perusahaan | Hanya super admin; admin perusahaan bisa mengubah perusahaannya sendiri. Branding tetap terbaca publik |
| Fungsi klaim lama bisa dipanggil tanpa login, untuk user mana saja | Harus login |

Yang sengaja **tidak** diubah, supaya alur tetap sama:
- Kontak di profil (termasuk email) tetap tampil di kartu publik, karena pemilik mengisinya untuk dibagikan.
- Trial PREMIUM 30 hari saat klaim.
- Klaim tanpa kode klaim. Ini keputusan terpisah di luar rilis ini.

## Urutan rilis (tanpa jeda kartu rusak)

1. **Snapshot.** Jalankan `supabase/rollback/024_lock_nfc_data_access_snapshot.sql` di SQL editor Supabase, lalu simpan hasil `restore_sql`.
2. **Bagian A.** Jalankan `supabase/migrations/023_nfc_public_functions.sql`. Ini hanya menambah fungsi; kode lama tetap jalan.
3. **Kode.** Gabung cabang `fix/nfc-data-access` ke `main`, lalu tunggu deploy Vercel selesai.
4. **Cek alur di live** (akun uji dan kartu uji):
   - Tap atau buka link kartu yang sudah diklaim: profil yang benar tampil.
   - Serial tidak terdaftar menampilkan "Serial Not Found".
   - Aktivasi kartu uji lewat Google dan lewat email baru.
   - Isi kado lewat link token, tap pertama menampilkan kejutan, lalu isian terkunci.
   - Login dan edit profil.
   - Admin: daftar nomor seri, buat, hapus, kado, sync. Admin perusahaan: aset dan analitik.
5. **Bagian B.** Jalankan `supabase/migrations/024_lock_nfc_data_access.sql`.
6. **Ulangi cek langkah 4**, lalu pastikan kunci publik tidak lagi bisa membaca tabel `serial_numbers` (hanya hitung baris, tanpa mengambil isi).

## Rollback

- **Masalah setelah langkah 5:** jalankan `supabase/rollback/024_lock_nfc_data_access_rollback.sql`, lalu `restore_sql` dari langkah 1. Kode baru tetap jalan dengan aturan lama.
- **Masalah setelah langkah 3:** revert merge di GitHub. Fungsi dari bagian A tidak mengganggu kode lama.

## Bukti uji

`supabase/tests/nfc-access/run.mjs` adalah uji Postgres lokal mirip Supabase dengan data dummy. Hasilnya 60/60 lulus:
- Celah terbukti ada sebelum perbaikan dan tertutup sesudahnya.
- Alur publik, pemilik, admin, dan admin perusahaan tetap jalan.
- Urutan A → kode → B aman.
- Rollback mengembalikan aturan lama persis.

Uji ini tidak menjalankan Supabase Auth atau PostgREST asli, dan tidak memakai unit fisik.
