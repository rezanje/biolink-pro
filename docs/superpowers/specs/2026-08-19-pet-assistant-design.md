# Pet Assistant — Desain Batch 1

Tanggal: 2026-08-19
Status: disetujui untuk masuk tahap rencana implementasi

## 1. Ringkasan

Setiap pemilik kartu punya satu karakter pixel art ("pet") yang jadi asisten pribadinya.
Pas pengunjung membuka profil publik, pet-nya keluar dari kartu sambil melambai, lalu mengecil
dan nongkrong di pojok layar sebagai tombol asisten yang hidup.

Batch 1 hanya mengerjakan **pet-nya**. Fitur dandan-dandanan, toko item, mode tamagotchi,
dan otak AI beneran adalah batch berikutnya. Desain ini dibuat supaya batch-batch itu
bisa numpang di atasnya tanpa membongkar ulang.

### Tujuan yang mau dicapai

1. Pengunjung yang tap kartu langsung dapat kejutan yang bikin dia inget dan cerita ke orang lain.
2. Pemilik kartu merasa profilnya "punya karakter", bukan sekadar daftar link.
3. Pondasi aset dan datanya siap menampung skin dan item dandanan tanpa gambar ulang karakter.
4. Menambah karakter baru di kemudian hari cukup menggambar kepala baru, bukan karakter utuh.

## 2. Ruang lingkup

### Masuk batch 1

- Dua karakter karikatur: **Widodo** dan **Saraswati**. Keduanya gratis untuk semua tier.
- Pet keluar dari kartu dan melambai di layar sapaan pembuka profil publik `/[slug]`.
- Pet mendarat di pojok kanan bawah, animasi diam (idle) berulang.
- Gelembung sapaan otomatis dari data profil + waktu setempat pengunjung.
- Tap pet membuka panel chat asisten (jawaban template yang sudah ada di `AIAssistant.tsx`,
  komponennya sudah ditulis tapi belum pernah dipasang di profil publik).
- Halaman dashboard `Asisten`: pilih karakter, kasih nama pet, nyalakan/matikan sapaan, preview.

### Tidak masuk batch 1

- Skin, item dandanan (topi, baju), inventaris, toko, dan pembayaran item.
- Mode tamagotchi layar penuh.
- Otak AI beneran (mengganti jawaban template) — batch 2.
- Suara / text-to-speech pet.
- Pet di halaman `/tap/[uuid]` versi serial independen (`ProfileView`). Rute `/tap/[uuid]`
  pada kondisi normal sudah melempar pengunjung ke `/[slug]`, jadi surface ini jarang kepakai.
  Ditangani di batch terpisah.

## 3. Alur pengalaman pengunjung

Urutan waktu sejak profil dibuka:

1. **t = 0** — Layar sapaan (overlay) yang sudah ada terbuka. Kalau pet aktif, muncul siluet
   kartu kecil di tengah, lalu pet **memanjat keluar dari kartu** dan memainkan klip `greet`
   (melambai). Animasi ketik `welcome_word` yang sudah ada tetap jalan seperti sekarang.
2. **Setelah teks selesai diketik** — overlay menutup. Jeda tutupnya jadi 2000 ms saat pet
   aktif (sekarang 800 ms tanpa animasi spesial, 3500 ms dengan animasi spesial).
3. **+200 ms** — pet berpindah ke pojok kanan bawah sambil mengecil, lalu ganti ke klip `idle`
   yang berulang terus.
4. **Setelah mendarat** — gelembung sapaan muncul di sebelah pet selama 4 detik, lalu mengempis.
5. **Kapan saja** — pengunjung tap pet, panel chat asisten terbuka. Pet ganti ke klip `talk`
   selama panel terbuka.

Keputusan desain penting: kalimat sapaan **tidak** ditaruh di overlay, tapi di gelembung
setelah pet mendarat. Alasannya, overlay sudah punya teks ketik `welcome_word` milik pemilik
kartu — dua teks berebut perhatian di layar yang sama bikin berantakan, dan gelembung di pojok
justru menarik mata pengunjung ke pet yang bisa diajak ngobrol.

Animasi "keluar dari kartu" dipilih karena hanya masuk akal di produk kartu NFC. Mascot yang
sekadar muncul bisa ditempel produk apa pun; pet yang keluar dari kartu tidak.

### Hormati fitur yang sudah ada

- Profil dengan animasi edisi spesial aktif (`shouldShowSpecialGreetingAnimation`) tetap
  menampilkan animasi spesialnya di overlay. Pet tidak ikut tampil di overlay, tapi tetap
  mendarat di pojok setelah overlay tutup. Tidak ada perilaku lama yang hilang.
- Profil dengan mode redirect aktif (`activeRedirectUrl`) tidak menampilkan pet sama sekali —
  pengunjung memang sedang dilempar ke tempat lain.

## 4. Arsitektur

Pemisahan tanggung jawab dibuat supaya tiap bagian bisa dites sendiri dan batch berikutnya
punya tempat menempel yang jelas.

| Berkas | Tanggung jawab | Bergantung pada |
| --- | --- | --- |
| `src/lib/pet/characters.ts` | Katalog karakter: id, nama, jalur sprite, jumlah frame, titik jangkar | — |
| `src/lib/pet/pet-selection.mjs` | Menentukan karakter yang dipakai sebuah profil dan fallback-nya | katalog |
| `src/lib/pet/pet-greeting.mjs` | Menyusun kalimat sapaan dari profil + jam | — |
| `src/components/pet/PetSprite.tsx` | Memutar satu klip sprite. Murni tampilan, tanpa tahu soal profil | katalog |
| `src/components/pet/PetGreeting.tsx` | Kartu + pet yang memanjat keluar, di dalam overlay sapaan | PetSprite |
| `src/components/pet/PetBuddy.tsx` | Pet di pojok + gelembung + tap membuka chat | PetSprite, pet-greeting |
| `src/app/[slug]/page.tsx` | Memasang ketiganya, mengatur urutan waktu | semua di atas |

`PetSprite` sengaja tidak tahu apa-apa soal profil atau Supabase: dia cuma terima
`characterId`, `clip`, dan `size`. Ini yang bikin dia bisa dipakai ulang di dashboard preview,
di mode tamagotchi nanti, dan di layar toko item nanti tanpa diubah.

### Perubahan pada komponen yang sudah ada

- `src/components/profile/AIAssistant.tsx` — tombol bulat (FAB) bawaannya tidak lagi selalu
  tampil. Komponennya menerima prop `open`, `onOpenChange`, dan `showFallbackTrigger`
  (default mati) supaya pemicunya dipegang `PetBuddy`, sementara tombol bulat lama tetap bisa
  dimunculkan sebagai cadangan waktu sprite pet gagal dimuat. Isi logika jawabannya tidak
  disentuh di batch 1.
- `src/lib/special-greeting.mjs` — `getWelcomeCloseDelay` menerima aturan baru: 2000 ms saat
  pet aktif dan animasi spesial tidak aktif. Urutan prioritas: animasi spesial (3500) >
  pet (2000) > default (800).
- `src/app/dashboard/ai-assistant/page.tsx` — blok "Coming Soon" diganti panel pemilih pet.
  Kunci Premium tingkat halaman dilepas, karena di batch 1 pet terbuka untuk semua tier.

## 5. Model data

Migrasi baru `supabase/migrations/012_pet_assistant.sql`:

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pet_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pet_character_id TEXT DEFAULT 'widodo',
ADD COLUMN IF NOT EXISTS pet_name TEXT DEFAULT NULL;
```

`supabase/complete-setup.sql` ikut diperbarui supaya database baru langsung punya kolom ini.

- `pet_enabled` — default menyala. Profil lama otomatis dapat pet default tanpa perlu
  menyentuh dashboard.
- `pet_character_id` — id dari katalog. Nilai tak dikenal diperlakukan sebagai default.
- `pet_name` — nama panggilan pet. Kosong berarti pakai nama bawaan karakter.

Kolom untuk skin dan item dandanan **belum** dibuat di batch 1. Saat batch dandanan jalan,
tambahnya satu kolom `pet_equipped JSONB` — tidak perlu mengubah kolom mana pun yang dibuat
sekarang.

Tidak ada tabel baru dan tidak ada perubahan aturan akses (RLS): kolom ini menempel di
`profiles` yang aturan bacanya sudah publik untuk keperluan halaman profil.

## 6. Katalog karakter

| id | Nama | Tier | Penampilan | Watak |
| --- | --- | --- | --- | --- |
| `widodo` | Widodo | Gratis (bawaan) | Rambut hitam rapi belah samping, kumis tipis, kemeja biru muda lengan digulung, celana gelap | Sabar, sopan, senior |
| `saraswati` | Saraswati | Gratis | Rambut disanggul rapi, kebaya modern hijau tosca, selendang tipis | Cekatan, hangat, teratur |

Keduanya adalah **karikatur orang generik** — bukan gambaran tokoh publik mana pun, bukan
potret orang nyata. Nama Widodo dan Saraswati dipakai sebagai nama Indonesia yang familiar.

Batch 1 tidak mengunci karakter di balik Premium. Alasannya: dengan hanya dua karakter,
mengunci salah satunya membuat pilihan pengguna gratis terasa kosong, sementara wow-factor
pet justru mesin pemasaran produk ini. Monetisasi dipindah ke skin dan item di batch 3, yang
justru lebih menguntungkan karena bisa dijual berkali-kali ke orang yang sama.

Karena tidak ada karakter berbayar di batch 1, tidak ada kunci fitur baru yang ditambahkan ke
tabel `tier_configs`.

## 7. Spesifikasi aset pixel art

Ini bagian paling penting untuk masa depan skin dan item. Aturannya dikunci sekarang supaya
baju dan topi tinggal ditumpuk, bukan digambar ulang per karakter.

### Aturan induk: satu badan dasar untuk semua karakter

Semua karakter memakai **rig yang sama persis** — proporsi, tinggi, posisi bahu, dan posisi
tangan tidak berubah antar karakter. Yang boleh berbeda hanya kepala, rambut, wajah, warna,
dan pakaian bawaan.

Konsekuensinya, dan ini alasan seluruh aturan di bawah ada:

- Satu topi yang digambar sekali langsung muat di semua karakter, sekarang dan yang akan datang.
- Menambah karakter ke-3 dan seterusnya cukup menggambar kepala dan pakaian baru di atas rig
  yang sama.
- Kalau tiap karakter punya bentuk badan sendiri, setiap item harus digambar ulang sebanyak
  jumlah karakter. Biaya toko item naik berlipat seiring katalog bertambah.

### Ukuran dan tata letak

- Satu frame = **64 x 64 piksel**, latar transparan.
- Satu karakter = satu berkas sprite sheet PNG: **grid 6 kolom x 3 baris = 384 x 192 piksel**.
- Baris 0 = klip `idle`, baris 1 = klip `greet`, baris 2 = klip `talk`.
- Jumlah frame terpakai per klip: `idle` 4, `greet` 6, `talk` 4. Sel sisa di kanan dibiarkan
  transparan; jumlah frame yang dibaca diambil dari katalog, bukan ditebak dari lebar berkas.
- Jalur berkas: `public/pet/<id>.png`.

### Ukuran rig (berlaku untuk semua karakter, satuan piksel dalam frame)

| Bagian | Aturan |
| --- | --- |
| Tinggi total | 52 px |
| Garis kaki | menyentuh y = 60 (sisakan 4 px untuk bayangan) |
| Puncak kepala | y = 8 |
| Kepala | lebar 26 px, tinggi 26 px, pusat di x = 32 |
| Badan | lebar 20 px, dari y = 34 sampai y = 60 |
| Garis bahu | y = 36 |
| Telapak tangan | kiri di (18, 44), kanan di (46, 44) |
| Wajah | mata dua titik/garis, tanpa hidung realistis, tanpa jari |

Proporsi karikatur: kepala setengah dari tinggi total. Sengaja dibuat begitu supaya wajahnya
masih terbaca waktu pet ditampilkan kecil di pojok layar HP.

### Titik jangkar (kontrak untuk skin dan item)

Setiap karakter mendeklarasikan titik jangkar yang sama di katalog:

- `head` — (32, 8), tempat topi/peci/kerudung menempel.
- `body` — (32, 40), tempat baju menempel.
- `handLeft` — (18, 44) dan `handRight` — (46, 44), tempat benda pegangan menempel.

Aturan yang harus dipatuhi semua karakter: posisi `head` tidak boleh bergeser lebih dari
**1 piksel** di sepanjang klip `idle`. Karena kepalanya nyaris diam, sebuah item cukup berupa
**satu gambar diam** yang ditempel di titik jangkar — item tidak perlu punya lembar animasi
sendiri. Ini yang bikin bikin item nanti murah. Kalau aturan 1 piksel ini dilanggar, tiap item
harus dianimasikan mengikuti kepala, dan biayanya melonjak.

### Penampilan di layar

- Dirender dengan `image-rendering: pixelated`, skala bulat saja (jangan 1,5x).
- Ukuran di overlay sapaan: **192 px** (3x). Ukuran di pojok: **64 px** (1x).
- Animasi memakai CSS `steps()` menggeser `background-position`, bukan menumpuk elemen per
  frame — supaya ringan di HP kentang dan tidak membebani baterai.
- Menghormati `prefers-reduced-motion`: animasi berhenti di frame pertama, pet tetap tampil,
  gelembung sapaan tetap muncul. Pet langsung berdiri di depan kartu tanpa animasi memanjat,
  dan langsung berada di pojok tanpa animasi berpindah.

### Aset sementara

Batch 1 dikirim dengan 2 sprite sheet placeholder sederhana (siluet rig dengan mata) yang
dibuat programatik. Fungsinya supaya fitur bisa diuji dan dinilai sebelum gambar sungguhan
jadi. Menukar ke gambar final = menimpa berkas PNG-nya saja, tanpa mengubah kode sama sekali.
Prompt untuk membuat gambar finalnya ada di Lampiran A.

## 8. Logika kalimat sapaan

`buildPetGreeting({ profile, now })` menyusun satu kalimat, tanpa memanggil AI dan tanpa
menunggu jaringan.

Bagian waktu, memakai jam perangkat pengunjung:

| Jam | Sapaan |
| --- | --- |
| 04:00–10:59 | Pagi |
| 11:00–14:59 | Siang |
| 15:00–17:59 | Sore |
| 18:00–03:59 | Malam |

Susunan kalimat:

- Nama pet ada dan nama pemilik ada: `"{Waktu}! Aku {petName}, asistennya {displayName}."`
- Nama pet kosong: pakai nama bawaan karakter dari katalog (Widodo atau Saraswati).
- Nama pemilik kosong: `"{Waktu}! Aku {petName}, asisten kartu ini."`
- Kalau `job_title` terisi, tambahkan kalimat kedua: `"Mau tahu soal {displayName}? Tanya aku."`

Fungsi ini ditulis sebagai `.mjs` murni tanpa React supaya bisa diuji langsung, mengikuti
pola `src/lib/special-greeting.mjs` yang sudah ada.

## 9. Dashboard

Halaman `/dashboard/ai-assistant` diganti isinya, judul jadi **Asisten**:

1. **Preview** — pet terpilih dalam ukuran besar memainkan klip `greet`, plus contoh kalimat
   sapaan persis seperti yang akan dilihat pengunjung.
2. **Pemilih karakter** — dua kartu bersebelahan, Widodo dan Saraswati, dengan nama dan watak
   singkat.
3. **Nama pet** — kolom teks, maksimal 20 karakter.
4. **Sakelar** — nyalakan/matikan pet di profil publik.
5. **Simpan** — memakai pola simpan yang sama dengan halaman dashboard lain.

Menu sidebar diganti namanya dari "AI Assistant" jadi "Asisten", ikonnya tetap.

## 10. Penanganan kegagalan

| Kejadian | Yang terjadi |
| --- | --- |
| Sprite gagal dimuat (jaringan/berkas hilang) | Pet tidak ditampilkan sama sekali. Panel chat tetap bisa dibuka lewat tombol bulat cadangan. Tidak ada gambar rusak di layar pengunjung. |
| `pet_character_id` tidak ada di katalog | Jatuh ke `widodo`. |
| `pet_enabled` mati | Tidak ada pet dan tidak ada tombol chat. Profil kembali persis seperti sekarang. |
| Profil sedang mode redirect | Pet dilewati sepenuhnya. |
| Kolom pet belum ada di database (migrasi belum jalan) | Nilai dianggap default, pet tampil dengan karakter bawaan. Tidak ada layar error. |

## 11. Akses chat di batch 1

Panel chat template terbuka untuk semua tier di batch 1. Isinya hanya memantulkan data yang
memang sudah publik di halaman profil (nama, jabatan, perusahaan, bio, tombol kontak), jadi
tidak ada informasi baru yang bocor.

Keputusan siapa yang berhak atas chat AI beneran diambil di batch 2, waktu biayanya sudah
kelihatan.

## 12. Pengujian

Tes otomatis (mengikuti pola `*.test.mjs` yang sudah ada di `src/lib/`):

- `pet-greeting.test.mjs` — empat rentang waktu, nama pet kosong, nama pemilik kosong,
  jabatan kosong.
- `pet-selection.test.mjs` — id tak dikenal jatuh ke default, `pet_enabled` mati mengembalikan
  "tidak ada pet", kedua karakter dapat dipilih oleh tier mana pun.

Pemeriksaan manual sebelum dianggap selesai:

- `npm run lint` dan `npm run build` bersih.
- Buka satu profil: pet keluar dari kartu, mendarat, gelembung muncul lalu hilang, tap
  membuka chat.
- Buka satu profil dengan animasi edisi spesial menyala: animasi spesial tetap menang di
  overlay, pet tetap mendarat di pojok.
- Buka profil dengan pet dimatikan: tampilannya sama persis seperti sebelum fitur ini ada.

## 13. Rencana batch berikutnya

Urutan ini yang desainnya sudah disiapkan:

1. **Batch 2 — otak AI.** Ganti isi jawaban `AIAssistant` dengan jawaban model, dibatasi
   pengetahuannya pada data profil. Perlu pagar biaya dan pembatasan jumlah pesan.
2. **Batch 3 — skin & dandanan.** Tambah kolom `pet_equipped`, katalog item yang memakai titik
   jangkar `head`/`body`/`hand`, dan layar dandan di dashboard. Di sinilah monetisasinya.
3. **Batch 4 — toko item.** Pembayaran, kepemilikan item, riwayat.
4. **Batch 5 — mode tamagotchi.** Layar penuh, memakai `PetSprite` yang sama dengan klip
   tambahan.
5. **Karakter tambahan.** Kapan saja setelah batch 1, dengan biaya kecil: cukup kepala dan
   pakaian baru di atas rig yang sama.

---

## Lampiran A — Prompt untuk membuat gambar karakter

### Cara pakai

Model gambar AI tidak bisa diandalkan mengeluarkan sprite sheet 384x192 yang presisi. Alurnya:

1. Generate **satu karakter, satu pose, satu gambar** dengan prompt di bawah, ukuran besar
   (1024x1024) bergaya pixel art.
2. Kecilkan ke 64x64 dengan metode *nearest neighbor* (Photoshop: Image Size → Nearest Neighbor;
   atau alat gratis seperti Piskel/Aseprite).
3. Rapikan tepi, hapus latar sampai benar-benar transparan, lalu geser karakternya supaya pas
   dengan ukuran rig di Bagian 7.
4. Susun frame-nya ke dalam grid 6x3.

Generate pose berikutnya dengan prompt yang sama, ganti bagian **[POSE]** saja, dan sertakan
gambar hasil pertama sebagai referensi supaya karakternya konsisten.

Kerjakan **Widodo lebih dulu sampai benar-benar pas dengan rig**, baru Saraswati dibuat dengan
Widodo sebagai referensi badan. Itu cara paling gampang memastikan kedua karakter memakai
badan yang sama.

### Blok gaya (tempel di setiap prompt)

```
16-bit pixel art sprite of a caricature human character, chunky readable pixels,
front-facing full body, single character centered, standing on flat ground,
big round head about half the total body height, small simple body, mitten hands with no fingers,
simple dot-and-line face, no realistic nose, friendly cartoon caricature, not photorealistic,
soft top-down light, limited palette of 8 colors, thick 1px dark outline,
subtle dithering only for shading, plain solid background, no text, no logo,
no background shadow, no gradient background, game asset style
```

### Prompt per karakter

Ganti `[POSE]` dengan salah satu:
`standing still, arms relaxed at the sides` (idle) /
`waving one hand high above the head, cheerful smile` (greet) /
`mouth open mid-speech, one hand gesturing forward` (talk).

**1. Widodo (karakter bawaan)**
```
A friendly middle-aged Indonesian man caricature, neat short black hair parted at the side,
thin moustache, warm calm smile, light blue long-sleeve shirt with sleeves rolled to the elbow,
dark trousers, simple dark shoes,
[POSE].
+ blok gaya
```

**2. Saraswati**
```
A friendly Indonesian woman caricature, black hair tied in a neat bun,
modern simple teal kebaya top with a thin shawl over one shoulder, long dark skirt,
calm confident smile,
[POSE].
+ blok gaya
```

### Yang harus dicek sebelum aset dipakai

- Latar benar-benar transparan, bukan putih.
- Kaki menyentuh y = 60, tinggi total 52 piksel, puncak kepala di y = 8.
- Lebar kepala 26 piksel, lebar badan 20 piksel, telapak tangan di (18, 44) dan (46, 44).
- **Kedua karakter harus punya ukuran badan yang identik.** Tumpuk gambar Widodo dan
  Saraswati di editor; kalau bahu, pinggang, atau garis kaki mereka tidak berimpit, perbaiki
  dulu. Ini syarat mati supaya satu baju muat di keduanya.
- Puncak kepala tidak bergeser lebih dari 1 piksel antar frame `idle`.

### Prompt untuk skin dan item (batch 3, disimpan di sini biar tidak hilang)

Item digambar sendirian tanpa karakter, lalu ditempel di titik jangkar.

```
16-bit pixel art [NAMA ITEM] only, no character, no head, no body,
floating alone on transparent background, front-facing, chunky readable pixels,
limited palette of 4 colors, thick 1px dark outline,
sized to sit on a 26-pixel-wide head inside a 64x64 sprite, game asset style
```

Untuk baju, ganti kalimat ukurannya jadi: `sized to fit a 20-pixel-wide body inside a 64x64 sprite`.
