'use client'

import { useState } from 'react'
import { Check, Copy, KeyRound, UserCheck, UserPlus } from 'lucide-react'

type Admin = { user_id: string; display_name: string | null; email: string | null }

const FIELD = 'w-full rounded-row bg-surface px-4 py-3 text-[13px] text-ink outline-none ring-1 ring-hairline focus:ring-ink/20'

// Akses admin perusahaan: tunjuk akun yang sudah ada, atau buatkan akun baru
// (email + password) tanpa perlu kartu.
export function CompanyAdminAccess({ companyId, admins, onChanged }: { companyId: string | null; admins: Admin[]; onChanged: () => Promise<void> }) {
    const [mode, setMode] = useState<'create' | 'assign'>('create')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [credentials, setCredentials] = useState<{ email: string; password: string; company: string } | null>(null)
    const [copied, setCopied] = useState(false)

    if (!companyId) {
        return <p className="rounded-row bg-fill-subtle px-4 py-3 text-[12.5px] text-ink-2">Simpan perusahaan dulu, lalu buka lagi untuk menambahkan admin perusahaan.</p>
    }

    const loginUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://my.gentanala.com'}/login?next=/company/dashboard`

    const submit = async () => {
        setBusy(true); setError(''); setNotice(''); setCredentials(null)
        try {
            const res = await fetch(mode === 'create' ? '/api/admin/companies/create-admin' : '/api/admin/companies/assign-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mode === 'create' ? { company_id: companyId, email, name } : { company_id: companyId, admin_email: email }),
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error || 'Gagal'); return }
            if (mode === 'create') setCredentials(data)
            else setNotice(data.message)
            setName(''); setEmail('')
            await onChanged()
        } catch {
            setError('Gagal terhubung. Coba lagi.')
        } finally {
            setBusy(false)
        }
    }

    const handover = credentials ? `Akses dashboard ${credentials.company}\nLink: ${loginUrl}\nEmail: ${credentials.email}\nPassword: ${credentials.password}\n\nSetelah masuk, ganti password lewat "Lupa password" di halaman login.` : ''

    return (
        <div className="rounded-row bg-fill-subtle p-4">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-2"><UserCheck className="h-4 w-4" strokeWidth={1.8} /> Admin perusahaan</p>
            <p className="mt-1 text-[12px] text-ink-2">Bisa membuka dashboard perusahaan. Tidak wajib punya kartu.</p>

            <ul className="mt-3 space-y-1.5">
                {admins.map(a => (
                    <li key={a.user_id} className="flex items-center justify-between rounded-row bg-surface px-3 py-2 text-[12.5px]">
                        <span className="font-medium">{a.display_name || '—'}</span>
                        <span className="text-ink-2">{a.email}</span>
                    </li>
                ))}
                {!admins.length && <li className="text-[12.5px] text-ink-3">Belum ada admin.</li>}
            </ul>

            <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
                {([['create', 'Buat akun baru', UserPlus], ['assign', 'Akun yang sudah ada', UserCheck]] as const).map(([key, label, Icon]) => (
                    <button key={key} type="button" onClick={() => { setMode(key); setError(''); setNotice('') }} className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium ${mode === key ? 'bg-ink text-white' : 'text-ink-2'}`}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} /> {label}
                    </button>
                ))}
            </div>

            <div className="mt-3 space-y-2">
                {mode === 'create' && <input aria-label="Nama admin" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Nama (mis. HRD Candra Naya)" className={FIELD} />}
                <input aria-label="Email admin" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@perusahaan.com" className={FIELD} />
                <button type="button" onClick={submit} disabled={busy || !email.trim()} className="w-full rounded-full bg-ink py-3 text-[13px] font-medium text-white disabled:opacity-40">
                    {busy ? 'Memproses...' : mode === 'create' ? 'Buat akun & password' : 'Jadikan admin'}
                </button>
            </div>

            {error && <p role="alert" className="mt-3 rounded-row bg-coral-soft px-3 py-2 text-[12px] text-coral-soft-ink">{error}</p>}
            {notice && <p className="mt-3 rounded-row bg-success-soft px-3 py-2 text-[12px] text-success-soft-ink">{notice}</p>}

            {credentials && (
                <div className="mt-3 rounded-row bg-surface p-3 ring-1 ring-coral/40">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold"><KeyRound className="h-3.5 w-3.5" strokeWidth={1.8} /> Akun dibuat. Simpan sekarang — password tidak bisa dilihat lagi.</p>
                    <pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-fill-subtle p-3 font-mono text-[11.5px] text-ink">{handover}</pre>
                    <button type="button" onClick={async () => { await navigator.clipboard.writeText(handover); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-fill-subtle px-3.5 py-2 text-[12px] font-medium">
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Tersalin' : 'Salin untuk dikirim'}
                    </button>
                </div>
            )}
        </div>
    )
}
