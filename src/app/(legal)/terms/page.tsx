import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Terms of Service | Gentanala',
    description: 'Ketentuan penggunaan akun Gentanala, profil digital NFC, fitur AI, dan layanan meeting.',
    alternates: { canonical: 'https://my.gentanala.com/terms' },
}

export default function TermsPage() {
    return <>
        <div>
            <p className="mb-3 text-sm">Ketentuan Layanan · Berlaku sejak 9 Oktober 2026</p>
            <h1>Terms of Service</h1>
            <p className="mt-5">Ketentuan ini mengatur penggunaan layanan profil digital Gentanala di my.gentanala.com dan fitur yang terhubung dengan perangkat NFC. Dengan membuat akun atau menggunakan layanan, Anda menyetujui ketentuan ini. Pemrosesan data pribadi dijelaskan dalam <Link href="/privacy">Privacy Policy</Link>.</p>
        </div>
        <section>
            <h2>1. Akun dan kelayakan penggunaan</h2>
            <p>Anda harus dapat membuat persetujuan yang sah menurut hukum yang berlaku. Jika Anda di bawah umur, penggunaan memerlukan persetujuan orang tua atau wali. Berikan informasi akun yang akurat, jaga kerahasiaan kredensial, dan beri tahu kami jika akun diduga disalahgunakan. Jika menggunakan layanan atas nama company atau event, pastikan Anda memiliki kewenangan yang diperlukan.</p>
        </section>
        <section>
            <h2>2. Profil digital dan perangkat NFC</h2>
            <p>Layanan memungkinkan Anda mengklaim serial perangkat yang sah, mengelola profil, membagikan tautan, menyimpan kontak/kartu, dan menggunakan fitur yang tersedia pada paket Anda. Anda hanya boleh mengklaim perangkat yang Anda miliki atau berhak kelola. Anda bertanggung jawab atas informasi yang dipublikasikan dan pembagian tautan NFC/QR maupun tautan kado yang dapat membuka konten terkait.</p>
            <p className="mt-4">Kemampuan membaca NFC bergantung pada perangkat, browser, koneksi internet, dan pengaturan penerima. Pembelian produk fisik, pengiriman, garansi, atau pengembalian mengikuti ketentuan yang ditampilkan oleh penjual pada saat transaksi; halaman ini mengatur layanan digital.</p>
        </section>
        <section>
            <h2>3. Konten dan hak kekayaan intelektual</h2>
            <p>Anda tetap memiliki hak atas konten Anda. Anda memberi Gentanala izin terbatas untuk menyimpan, memproses, dan menampilkan konten tersebut sejauh diperlukan untuk menyediakan layanan dan fitur yang Anda pilih. Pastikan Anda memiliki hak atau izin atas foto, logo, teks, kontak, serta data pihak lain yang diunggah.</p>
            <p className="mt-4">Merek, desain aplikasi, dan perangkat lunak Gentanala tetap milik pemegang haknya. Penggunaan layanan tidak memberikan hak kepemilikan atasnya.</p>
        </section>
        <section>
            <h2>4. Penggunaan yang dilarang</h2>
            <ul>
                <li>Menyamar sebagai orang atau organisasi lain, melakukan penipuan, spam, phishing, atau menyebarkan malware.</li>
                <li>Mempublikasikan konten ilegal, melanggar hak pihak lain, atau membagikan data pribadi tanpa dasar yang sah.</li>
                <li>Mengakses akun, data, perangkat, atau fitur yang bukan kewenangan Anda; mengakali batasan paket; atau mengganggu keamanan dan ketersediaan layanan.</li>
                <li>Menggunakan layanan untuk mengumpulkan atau memanfaatkan data pengunjung secara melanggar hukum.</li>
            </ul>
        </section>
        <section>
            <h2>5. Company, event, dan data pengunjung</h2>
            <p>Administrator company dan event bertanggung jawab atas kewenangan pengelolaan akun dan perangkatnya. Pemilik profil yang menerima kontak, chat, atau permintaan meeting harus menggunakan informasi pengunjung sesuai tujuan pengiriman dan hukum yang berlaku. Keterkaitan akun/perangkat dengan company atau event tidak memberikan izin otomatis untuk menggunakan data bagi pemasaran yang tidak diminta.</p>
        </section>
        <section>
            <h2>6. Fitur AI dan layanan pihak ketiga</h2>
            <p>Jawaban asisten, terjemahan, bio, dan gambar yang dibuat AI dapat tidak akurat atau tidak sesuai konteks. Tinjau hasilnya sebelum digunakan atau dipublikasikan. Hasil AI tidak menggantikan nasihat profesional dan tidak dapat dianggap sebagai janji atau keputusan yang mengikat dari pemilik profil.</p>
            <p className="mt-4">Login, hosting, AI, Calendar, dan tautan eksternal dapat bergantung pada pihak ketiga serta ketentuan mereka. Gentanala tidak mengendalikan semua perubahan atau gangguan pada layanan pihak ketiga.</p>
        </section>
        <section>
            <h2>7. Permintaan meeting dan Google Calendar</h2>
            <p>Mengirim permintaan meeting tidak berarti jadwal telah dikonfirmasi. Pemilik profil harus menyetujuinya terlebih dahulu; setelah disetujui, layanan memeriksa ketersediaan dan membuat event serta undangan Google Calendar. Periksa status permintaan dan undangan Anda sebelum menghadiri meeting.</p>
            <p className="mt-4">Pemilik profil menentukan jadwal, memberikan izin koneksi Google, dan bertanggung jawab atas persetujuan meeting. Memutus koneksi tidak membatalkan event yang sudah dibuat. Perubahan atau pembatalan event yang telah dibuat dapat dilakukan langsung melalui Google Calendar dan perlu dikomunikasikan kepada peserta.</p>
        </section>
        <section>
            <h2>8. Paket, pembayaran, dan perubahan fitur</h2>
            <p>Akses fitur dapat bergantung pada paket, produk, atau penetapan akun Anda. Jika layanan berbayar ditawarkan, harga, masa berlaku, perpanjangan, pembatalan, dan ketentuan pengembalian yang relevan harus ditampilkan pada penawaran atau transaksi tersebut. Ketentuan ini tidak menetapkan perpanjangan otomatis atau menghapus hak konsumen yang diwajibkan hukum.</p>
            <p className="mt-4">Kami dapat memperbarui fitur, melakukan pemeliharaan, atau menyesuaikan layanan. Kami akan menyampaikan perubahan material yang memengaruhi hak atau layanan berbayar melalui sarana yang tersedia sebagaimana diwajibkan hukum.</p>
        </section>
        <section>
            <h2>9. Penghentian dan penghapusan akun</h2>
            <p>Kami dapat membatasi atau menangguhkan akses untuk menangani pelanggaran ketentuan, risiko keamanan, kewajiban hukum, atau penyalahgunaan. Anda dapat menghubungi kami untuk menghentikan penggunaan dan meminta penghapusan akun/data. Proses penghapusan dan pengecualiannya mengikuti Privacy Policy. Penghapusan akun tidak otomatis menghapus konten yang telah disalin penerima atau event yang tersimpan pada layanan pihak ketiga.</p>
        </section>
        <section>
            <h2>10. Ketersediaan dan tanggung jawab</h2>
            <p>Kami berupaya menjaga layanan berfungsi, tetapi tidak menjamin layanan selalu tersedia, bebas kesalahan, atau hasil AI dan analitik selalu akurat. Anda bertanggung jawab atas keputusan yang dibuat berdasarkan konten dan informasi yang diterima melalui layanan.</p>
            <p className="mt-4">Sepanjang diizinkan hukum, Gentanala tidak bertanggung jawab atas kerugian tidak langsung akibat gangguan layanan, tindakan pihak ketiga, atau penyalahgunaan akun di luar kendali kami. Pembatasan ini tidak berlaku terhadap tanggung jawab yang tidak dapat dibatasi atau dikecualikan berdasarkan hukum, dan tidak mengurangi hak konsumen yang wajib dilindungi.</p>
        </section>
        <section>
            <h2>11. Hukum, penyelesaian masalah, dan perubahan ketentuan</h2>
            <p>Ketentuan ini mengikuti hukum yang berlaku di Indonesia, dengan tetap menghormati hak wajib pengguna di yurisdiksi yang berlaku. Jika ada masalah atau sengketa, hubungi kami terlebih dahulu untuk mencari penyelesaian. Hak Anda untuk menempuh mekanisme pengaduan atau penyelesaian sengketa yang tersedia menurut hukum tetap berlaku.</p>
            <p className="mt-4">Versi terbaru ketentuan dan tanggal berlakunya akan dipublikasikan pada halaman ini. Perubahan material akan disampaikan melalui sarana yang tersedia sebagaimana diwajibkan hukum.</p>
        </section>
        <section id="contact">
            <h2>12. Kontak layanan</h2>
            <p>Untuk pertanyaan tentang layanan, akun, atau ketentuan ini, hubungi Gentanala melalui <a href="mailto:gentanala.id@gmail.com">gentanala.id@gmail.com</a>. Untuk informasi tentang pemrosesan data, lihat <Link href="/privacy">Privacy Policy</Link>.</p>
        </section>
    </>
}
