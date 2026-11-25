import { redirect } from 'next/navigation'

// Halaman lama portal perusahaan; isinya pindah ke Ringkasan, Karyawan, dan Leads.
export default function Page() {
    redirect('/company/dashboard')
}
