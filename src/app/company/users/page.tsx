'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, ArrowUpRight } from 'lucide-react'
import { useCompany } from '@/app/company/company-context'

interface Person { id: string; display_name: string | null; email: string | null; job_title: string | null; slug: string | null; lead_capture_enabled: boolean }
interface PeoplePage { people: Person[]; total: number; page: number; pageSize: number }

export default function CompanyUsersPage() {
    const { company } = useCompany()
    const [query, setQuery] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [result, setResult] = useState<PeoplePage | null>(null)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState<string | null>(null)
    const load = useCallback(async () => {
        const response = await fetch(`/api/company/workspace?view=people&page=${page}&q=${encodeURIComponent(search)}`, { cache: 'no-store' })
        if (!response.ok) throw Error('Gagal memuat pemilik kartu')
        setResult(await response.json())
    }, [page, search])
    useEffect(() => { load().catch(() => setError('Gagal memuat pemilik kartu.')) }, [load])
    async function toggle(person: Person) {
        setSaving(person.id); setError('')
        try {
            const response = await fetch('/api/company/workspace', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'lead_capture', profileId: person.id, enabled: !person.lead_capture_enabled }) })
            if (!response.ok) throw Error('Gagal memperbarui kartu')
            await load()
        } catch { setError('Gagal memperbarui pengumpulan leads.') } finally { setSaving(null) }
    }
    return <div className="space-y-7">
        <div><p className="uppercase tracking-[.22em] text-xs font-bold text-[var(--company-accent)]">Tim / Database</p><h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mt-3">Pemilik kartu</h1><p className="text-[#637268] mt-3">Kartu digital yang terkait dengan {company?.name}. Atur pengumpulan leads untuk tiap kartu.</p></div>
        <form onSubmit={event => { event.preventDefault(); setPage(1); setSearch(query) }} className="flex gap-2 max-w-lg"><label className="sr-only" htmlFor="people-search">Cari pemilik kartu</label><input id="people-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama, email, atau jabatan" className="min-w-0 flex-1 rounded-lg border border-[#cbd5c9] bg-white px-4 py-3 focus-visible:outline-2 focus-visible:outline-[var(--company-accent)]" /><button className="rounded-lg bg-[var(--company-primary)] text-white px-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--company-accent)]" aria-label="Cari"><Search className="w-4 h-4" /></button></form>
        {error && <p role="alert" className="text-red-800">{error}</p>}
        <div className="bg-white border border-[#dce3d9] rounded-2xl overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead className="bg-[#eef2eb] text-xs uppercase tracking-wide text-[#546358]"><tr><th className="px-5 py-4">Pemilik kartu</th><th className="px-5 py-4">Jabatan</th><th className="px-5 py-4">Kartu</th><th className="px-5 py-4">Pengumpulan leads</th></tr></thead><tbody className="divide-y divide-[#edf0e9]">{result?.people.map(person => <tr key={person.id}><td className="px-5 py-4"><p className="font-semibold">{person.display_name || 'Tanpa nama'}</p><p className="text-sm text-[#68776d]">{person.email || '—'}</p></td><td className="px-5 py-4 text-sm">{person.job_title || '—'}</td><td className="px-5 py-4">{person.slug ? <Link href={`/${person.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--company-accent)] hover:underline inline-flex items-center gap-1">Lihat <ArrowUpRight className="w-3 h-3" /></Link> : '—'}</td><td className="px-5 py-4"><button type="button" disabled={saving === person.id} onClick={() => toggle(person)} aria-label={`${person.lead_capture_enabled ? 'Matikan' : 'Aktifkan'} pengumpulan leads untuk ${person.display_name || 'kartu'}`} className="rounded-full px-3 py-1.5 text-xs font-semibold border border-[#cbd5c9] hover:border-[var(--company-accent)] focus-visible:outline-2 focus-visible:outline-[var(--company-accent)] disabled:opacity-50">{person.lead_capture_enabled ? 'Aktif' : 'Nonaktif'}</button></td></tr>)}</tbody></table>{!result?.people.length && <p className="p-8 text-[#637268]">{result ? 'Belum ada pemilik kartu.' : 'Memuat data…'}</p>}</div>
        {result && <div className="flex items-center justify-between text-sm text-[#637268]"><span>{result.total} pemilik kartu</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="border rounded-lg px-3 py-2 disabled:opacity-40">Sebelumnya</button><span className="py-2">{page}</span><button disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)} className="border rounded-lg px-3 py-2 disabled:opacity-40">Berikutnya</button></div></div>}
    </div>
}
