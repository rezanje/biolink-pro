# Target AR kartu (pilot hologram)

- Gambar contoh: `public/ar/targets/sample-card.svg` / `.png` (bukan desain final; ganti dengan artwork kartu dari tim desain).
- File target MindAR: `public/ar/targets/sample-card.mind`.

Menyusun ulang target setelah artwork berubah (jalur CPU, tanpa GPU):

1. Pasang di folder terpisah: `npm install --ignore-scripts mind-ar@1.2.5 three@0.160.0`.
2. Salin `compile-node.mjs` dan `detect-test.mjs` ke subfolder di folder itu.
3. `node compile-node.mjs kartu.png kartu.mind`
4. `node detect-test.mjs kartu.png kartu.mind` — cek kartu dikenali pada beberapa sudut dan tidak salah mendeteksi latar kosong.

Library di `public/vendor/` (MindAR 1.2.5, three 0.160.0, lisensi MIT) dimuat langsung oleh `public/ar/hologram.html` lewat import map, tidak lewat bundel Next.
