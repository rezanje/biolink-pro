# Target AR kartu (pilot hologram)

- Target: `public/ar/targets/kartu-uji-01.png` = PNG asli "Target AR Kartu Uji 01" dari tim desain (1700×1080 px, cetak 85×54 mm matte, tanpa crop). File ini juga yang dicetak; sha256 82bf08ed….
- File target MindAR: `public/ar/targets/kartu-uji-01.mind`.

Menyusun ulang target setelah artwork berubah (jalur CPU, tanpa GPU):

1. Pasang di folder terpisah: `npm install --ignore-scripts mind-ar@1.2.5 three@0.160.0`.
2. Salin `compile-node.mjs` dan `detect-test.mjs` ke subfolder di folder itu.
3. `node compile-node.mjs kartu.png kartu.mind`
4. `node detect-test.mjs kartu.png kartu.mind` — cek kartu dikenali pada beberapa sudut dan tidak salah mendeteksi latar kosong.

Library di `public/vendor/` (MindAR 1.2.5, three 0.160.0, lisensi MIT) dimuat langsung oleh `public/ar/hologram.html` lewat import map, tidak lewat bundel Next.
