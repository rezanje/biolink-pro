import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Privacy Policy | Gentanala',
    description: 'Kebijakan privasi Gentanala untuk akun, profil digital NFC, analitik, fitur AI, dan integrasi Google Calendar.',
    alternates: { canonical: 'https://my.gentanala.com/privacy' },
}

export default function PrivacyPage() {
    return <>
        <div>
            <p className="mb-3 text-sm">Kebijakan Privasi · Berlaku sejak 9 Oktober 2026</p>
            <h1>Privacy Policy</h1>
            <p className="mt-5">Kebijakan ini menjelaskan bagaimana Gentanala memproses data ketika Anda menggunakan layanan profil digital di my.gentanala.com, perangkat NFC yang terhubung, dan fitur pendukungnya. Kebijakan ini berlaku bagi pemilik akun dan pengunjung profil.</p>
        </div>
        <section>
            <h2>1. Data yang kami proses</h2>
            <ul>
                <li><strong>Data akun:</strong> nama, email, informasi autentikasi, dan foto profil yang Anda berikan atau izinkan melalui penyedia login, termasuk Google.</li>
                <li><strong>Data profil:</strong> bio, foto, nomor kontak, perusahaan, jabatan, tautan, serta konten yang Anda pilih untuk ditampilkan atau diunggah.</li>
                <li><strong>Data perangkat dan layanan:</strong> nomor serial NFC, status klaim, jenis perangkat, keterkaitan company/event, pengaturan fitur, dan paket akun.</li>
                <li><strong>Data penggunaan:</strong> kunjungan profil, klik tautan, tap NFC, waktu aktivitas, jenis perangkat/browser, halaman rujukan, dan perkiraan lokasi berbasis alamat IP jika tersedia.</li>
                <li><strong>Data interaksi:</strong> informasi kontak yang dikirim pengunjung, kartu yang disimpan, folder, pesan kado, percakapan dengan asisten AI, dan permintaan meeting, termasuk nama, email, waktu, serta catatan.</li>
            </ul>
            <p className="mt-4">Anda menentukan informasi yang Anda masukkan. Jangan mengunggah data sensitif atau data orang lain tanpa dasar dan izin yang sesuai.</p>
        </section>
        <section>
            <h2>2. Tujuan penggunaan dan dasar pemrosesan</h2>
            <p>Kami menggunakan data untuk membuat dan mengamankan akun, menghubungkan perangkat NFC dengan profil, menampilkan konten pilihan Anda, menyediakan analitik, menyimpan interaksi, menjalankan fitur AI yang digunakan, dan memproses meeting. Data juga digunakan untuk dukungan pengguna, pencegahan penyalahgunaan, dan pemenuhan kewajiban hukum. Pemrosesan dilakukan berdasarkan persetujuan Anda, pelaksanaan layanan yang Anda minta, kepentingan yang sah dengan mempertimbangkan hak Anda, atau kewajiban hukum yang berlaku.</p>
        </section>
        <section id="google-calendar">
            <h2>3. Login Google dan integrasi Google Calendar</h2>
            <p>Login dengan Google digunakan untuk autentikasi dan informasi identitas yang Anda izinkan. Koneksi Google Calendar merupakan fitur opsional dengan persetujuan terpisah.</p>
            <ul className="mt-4">
                <li><strong>Akses:</strong> setelah Anda memberi izin, kami menerima identitas akun Google (ID akun dan email), token akses/refresh, informasi waktu sibuk pada kalender utama, dan informasi event yang terkait dengan booking yang dibuat oleh layanan.</li>
                <li><strong>Penggunaan:</strong> informasi waktu sibuk digunakan untuk menentukan ketersediaan. Event meeting dan undangan kepada email pengunjung dibuat hanya setelah pemilik profil menyetujui permintaan. Nama, email, catatan, dan waktu meeting dikirim ke Google untuk tujuan ini.</li>
                <li><strong>Penyimpanan:</strong> identitas koneksi dan token yang dienkripsi disimpan untuk mempertahankan koneksi. Kami menyimpan informasi permintaan meeting serta ID/tautan event yang dibuat. Token tidak ditampilkan pada profil publik.</li>
                <li><strong>Batas penggunaan:</strong> data yang diperoleh dari Google Calendar digunakan hanya untuk menyediakan dan mendukung fitur meeting yang Anda minta. Data tersebut tidak dijual, digunakan untuk iklan, atau digunakan untuk melatih model AI umum. Data Calendar tidak dikirim ke fitur AI atau penerjemahan.</li>
                <li><strong>Akses manusia:</strong> akses terhadap data pengguna Google dibatasi pada izin pengguna, kebutuhan keamanan atau penanganan penyalahgunaan, kewajiban hukum, atau operasi internal terhadap data yang telah diagregasi dan dianonimkan sebagaimana diizinkan kebijakan Google.</li>
            </ul>
            <p className="mt-4">Penggunaan dan transfer informasi yang diterima dari Google APIs tunduk pada <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, termasuk persyaratan Limited Use.</p>
            <p className="mt-4">Anda dapat memutus koneksi lewat Dashboard → AI &amp; Translate → Meeting requests → Disconnect. Ini menghapus koneksi dan token yang disimpan serta menonaktifkan permintaan meeting baru. Anda juga dapat mencabut izin melalui <a href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">pengaturan koneksi akun Google</a>. Memutus koneksi tidak otomatis menghapus event atau undangan yang sudah dibuat di Google Calendar; Anda dapat mengelolanya langsung di Google. Untuk meminta penghapusan data meeting yang tersimpan di Gentanala, hubungi kontak di bawah.</p>
        </section>
        <section>
            <h2>4. Informasi publik dan akses pihak lain</h2>
            <p>Informasi pada profil yang Anda publikasikan dapat dilihat oleh pengunjung, dibagikan melalui tautan/NFC/QR, disimpan oleh penerima, atau terindeks mesin pencari. Pengunjung yang mengirim kontak, percakapan, atau permintaan meeting harus memahami bahwa data tersebut dapat dilihat pemilik profil. Administrator company dapat mengelola data akun dalam company yang menjadi kewenangannya; administrator layanan dapat mengakses data untuk menjalankan dan mendukung layanan.</p>
            <p className="mt-4">Kami tidak menjual data pribadi. Kami dapat mengungkapkan data apabila diperlukan untuk memenuhi kewajiban hukum, melindungi keamanan, atau menangani penyalahgunaan.</p>
        </section>
        <section>
            <h2>5. Penyedia layanan dan fitur AI</h2>
            <p>Kami menggunakan penyedia infrastruktur dan fitur, termasuk Supabase untuk autentikasi, database, dan penyimpanan; Vercel untuk hosting; Google untuk login, Calendar, dan layanan AI Gemini; serta ipapi.co untuk perkiraan lokasi pengunjung. Permintaan ke layanan perkiraan lokasi dapat mengungkapkan alamat IP kepada penyedia tersebut.</p>
            <p className="mt-4">Saat Anda menggunakan fitur AI, konten yang diperlukan untuk fitur tersebut dapat dikirim ke Google Gemini, termasuk teks untuk penerjemahan, foto untuk fitur gambar, atau pesan dan informasi profil/pengetahuan yang digunakan asisten. Percakapan asisten dapat disimpan dan ditinjau oleh pemilik profil. Jangan mengirim informasi rahasia atau sensitif yang tidak ingin diproses untuk fitur tersebut. Pemrosesan oleh penyedia mengikuti kebijakan dan ketentuan layanan mereka.</p>
            <p className="mt-4">Penyedia dapat memproses data di luar Indonesia. Kami menggunakan penyedia untuk keperluan layanan dan menerapkan pembatasan akses sesuai fungsi masing-masing. Situs atau tautan eksternal yang Anda kunjungi memiliki kebijakan privasinya sendiri.</p>
        </section>
        <section>
            <h2>6. Cookie dan penyimpanan browser</h2>
            <p>Cookie dan penyimpanan lokal browser digunakan untuk mempertahankan sesi login, menyimpan preferensi, dan mendukung fungsi layanan. Analitik mencatat interaksi dengan profil. Anda dapat menghapus atau membatasi penyimpanan browser melalui pengaturan browser; beberapa fitur, terutama login, dapat terpengaruh.</p>
        </section>
        <section>
            <h2>7. Keamanan dan penyimpanan data</h2>
            <p>Kami menerapkan autentikasi, pembatasan akses berdasarkan peran, dan enkripsi token Google Calendar. Tidak ada sistem yang dapat menjamin keamanan mutlak. Data disimpan selama diperlukan untuk menjalankan layanan, menangani permintaan pengguna, keamanan, atau kewajiban hukum. Penghapusan dapat memiliki pengecualian untuk data yang wajib disimpan atau salinan cadangan; salinan yang sudah diterima pihak lain tidak selalu dapat dihapus oleh Gentanala.</p>
        </section>
        <section>
            <h2>8. Pilihan dan hak Anda</h2>
            <p>Anda dapat memperbarui informasi profil, mengatur konten yang ditampilkan, dan memutus koneksi Calendar melalui dashboard. Sesuai hukum yang berlaku, Anda dapat meminta akses, koreksi, penghapusan akun/data, atau menarik persetujuan pemrosesan melalui kontak di bawah. Kami dapat meminta verifikasi identitas agar permintaan tidak mengungkapkan atau menghapus data milik orang lain. Penarikan persetujuan dapat membatasi fitur yang bergantung pada data tersebut.</p>
        </section>
        <section>
            <h2>9. Pengguna anak dan perubahan kebijakan</h2>
            <p>Layanan ditujukan bagi pengguna yang dapat membuat persetujuan penggunaan layanan yang sah. Pengguna di bawah umur harus memperoleh persetujuan orang tua atau wali sesuai hukum yang berlaku. Jika Anda mengetahui data anak diproses tanpa persetujuan yang diperlukan, hubungi kami. Kebijakan ini dapat diperbarui; versi terbaru dan tanggal berlakunya akan dipublikasikan pada halaman ini.</p>
        </section>
        <section id="contact">
            <h2>10. Kontak privasi</h2>
            <p>Untuk pertanyaan privasi atau permintaan akses, koreksi, dan penghapusan data, hubungi Gentanala melalui <a href="mailto:rezarahman@gentanala.com">rezarahman@gentanala.com</a>. Sebutkan email akun atau tautan profil yang terkait dan jenis permintaan Anda. Jangan mengirim kata sandi atau token akses.</p>
            <p className="mt-4">Lihat juga <Link href="/terms">Terms of Service</Link>.</p>
        </section>
    </>
}
