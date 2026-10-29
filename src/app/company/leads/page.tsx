'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { COMPANY_LEAD_STATUSES } from '@/lib/company-workspace.mjs'

interface Lead { id: string; name: string; email: string | null; whatsapp: string | null; company: string | null; status: string; created_at: string; profiles: { display_name: string | null } }
interface LeadPage { leads: Lead[]; total: number; page: number; pageSize: number }
const labels: Record<string, string> = { new: 'Baru', contacted: 'Dihubungi', converted: 'Konversi', failed: 'Tidak lanjut' }

export default function CompanyLeadsPage() {
    const initial = useSearchParams().get('status') || 'all'
    const [status, setStatus] = useState(initial === 'all' || COMPANY_LEAD_STATUSES.includes(initial) ? initial : 'all')
    const [query, setQuery] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [result, setResult] = useState<LeadPage | null>(null)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState<string | null>(null)
    const load = useCallback(async () => {
        const response = await fetch(`/api/company/workspace?view=leads&page=${page}&status=${status}&q=${encodeURIComponent(search)}`, { cache: 'no-store' })
        if (!response.ok) throw Error('Gagal memuat leads')
        setResult(await response.json())
    }, [page, status, search])
    useEffect(() => { load().catch(() => setError('Gagal memuat leads.')) }, [load])
    async function update(lead: Lead, nextStatus: string) {
        setSaving(lead.id); setError('')
        try {
            const response = await fetch('/api/company/workspace', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'lead_status', leadId: lead.id, status: nextStatus }) })
            if (!response.ok) throw Error('Gagal menyimpan')
            await load()
        } catch { setError('Gagal menyimpan status lead.') } finally { setSaving(null) }
    }
    return <div className="space-y-7">
        <div><p className="uppercase tracking-[.22em] text-xs font-bold text-[var(--company-accent)]">CRM / Tindak lanjut</p><h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mt-3">Leads & progress</h1><p className="text-[#637268] mt-3">Kontak yang masuk melalui kartu perusahaan dan status tindak lanjutnya.</p></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter status">{['all', ...COMPANY_LEAD_STATUSES].map(item => <button key={item} type="button" onClick={() => { setStatus(item); setPage(1) }} aria-pressed={status === item} className={`rounded-full px-4 py-2 text-sm font-medium border focus-visible:outline-2 focus-visible:outline-[var(--company-accent)] ${status === item ? 'bg-[var(--company-primary)] text-white border-transparent' : 'bg-white border-[#cbd5c9]'}`}>{item === 'all' ? 'Semua' : labels[item]}</button>)}</div>
        <form onSubmit={event => { event.preventDefault(); setPage(1); setSearch(query) }} className="flex gap-2 max-w-lg"><label className="sr-only" htmlFor="lead-search">Cari lead</label><input id="lead-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama, email, atau perusahaan" className="min-w-0 flex-1 rounded-lg border border-[#cbd5c9] bg-white px-4 py-3 focus-visible:outline-2 focus-visible:outline-[var(--company-accent)]" /><button className="rounded-lg bg-[var(--company-primary)] text-white px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--company-accent)]">Cari</button></form>
        {error && <p role="alert" className="text-red-800">{error}</p>}
        <div className="bg-white border border-[#dce3d9] rounded-2xl overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#eef2eb] text-xs uppercase tracking-wide text-[#546358]"><tr><th className="px-5 py-4">Lead</th><th className="px-5 py-4">Kontak</th><th className="px-5 py-4">Kartu asal</th><th className="px-5 py-4">Masuk</th><th className="px-5 py-4">Progress</th></tr></thead><tbody className="divide-y divide-[#edf0e9]">{result?.leads.map(lead => <tr key={lead.id}><td className="px-5 py-4"><p className="font-semibold">{lead.name}</p><p className="text-sm text-[#68776d]">{lead.company || '—'}</p></td><td className="px-5 py-4 text-sm"><p>{lead.email || '—'}</p><p>{lead.whatsapp || ''}</p></td><td className="px-5 py-4 text-sm">{lead.profiles?.display_name || '—'}</td><td className="px-5 py-4 text-sm">{new Date(lead.created_at).toLocaleDateString('id-ID')}</td><td className="px-5 py-4"><select aria-label={`Status ${lead.name}` } id={`status-${lead.id}`} value={lead.status} disabled={saving === lead.id} onChange={event => update(lead, event.target.value)} className="rounded-lg border border-[#cbd5c9] px-3 py-2 text-sm bg-white focus-visible:outline-2 focus-visible:outline-[var(--company-accent)] disabled:opacity-50">{COMPANY_LEAD_STATUSES.map(item => <option key={item} value={item}>{labels[item]}</option>)}</select></td></tr>)}</tbody></table>{!result?.leads.length && <p className="p-8 text-[#637268]">{result ? 'Belum ada leads dalam filter ini.' : 'Memuat data…'}</p>}</div>
        {result && <div className="flex items-center justify-between text-sm text-[#637268]"><span>{result.total} leads</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="border rounded-lg px-3 py-2 disabled:opacity-40">Sebelumnya</button><span className="py-2">{page}</span><button disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)} className="border rounded-lg px-3 py-2 disabled:opacity-40">Berikutnya</button></div></div>}
    </div>
}
