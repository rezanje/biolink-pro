'use client'

import { useMemo, useState } from 'react'
import { Download, Mail, Phone, Search } from 'lucide-react'
import { useCompany } from '@/app/company/company-context'
import { COMPANY_LEAD_STATUSES, LEAD_STATUS_LABELS } from '@/lib/company-workspace.mjs'
import { leadStatusBadge } from '@/components/company/lead-status'

const PAGE = 30
const LABELS = LEAD_STATUS_LABELS as Record<string, string>

function csvCell(value: unknown) {
    const text = String(value ?? '')
    // Cegah formula spreadsheet dari isian lead.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
}

export default function CompanyLeadsPage() {
    const { data, updateLeadStatus } = useCompany()
    const [q, setQ] = useState('')
    const [status, setStatus] = useState('all')
    const [person, setPerson] = useState('all')
    const [limit, setLimit] = useState(PAGE)
    const [saving, setSaving] = useState<string | null>(null)

    const people = useMemo(() => new Map((data?.people || []).map(p => [p.id, p.display_name || 'Tanpa nama'])), [data])
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase()
        return (data?.leads || []).filter(l =>
            (status === 'all' || (l.status || 'new') === status) &&
            (person === 'all' || l.profile_id === person) &&
            (!term || [l.name, l.email, l.whatsapp, l.company, l.job_title].some(v => v?.toLowerCase().includes(term))))
    }, [data, q, status, person])

    if (!data) return null

    const exportCsv = () => {
        const header = ['Tanggal', 'Nama', 'Email', 'WhatsApp', 'Perusahaan', 'Jabatan', 'Status', 'Karyawan']
        const lines = filtered.map(l => [new Date(l.created_at).toISOString(), l.name, l.email, l.whatsapp, l.company, l.job_title, leadStatusBadge(l.status).label, people.get(l.profile_id)].map(csvCell).join(','))
        const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `leads-${data.company.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
    }

    const changeStatus = async (leadId: string, next: string) => {
        setSaving(leadId)
        const ok = await updateLeadStatus(leadId, next)
        setSaving(null)
        if (!ok) alert('Status lead gagal diubah. Coba lagi.')
    }

    return (
        <div>
            <header className="mt-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[26px] font-semibold tracking-[-0.03em]">Leads</h1>
                    <p className="mt-1.5 text-[13px] text-ink-2">{data.leads.length} kontak dari kartu karyawan{data.leadsTruncated ? ' (2.000 terbaru)' : ''}</p>
                </div>
                <button onClick={exportCsv} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[12.5px] font-medium shadow-row disabled:opacity-50">
                    <Download className="h-4 w-4" strokeWidth={1.8} /> Export CSV
                </button>
            </header>

            <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.8} />
                    <input value={q} onChange={e => { setQ(e.target.value); setLimit(PAGE) }} placeholder="Cari nama, email, WhatsApp, perusahaan..." className="w-full rounded-full bg-surface py-3 pl-11 pr-4 text-[13px] shadow-row outline-none placeholder:text-ink-3 focus:ring-1 focus:ring-ink/15" />
                </div>
                <select aria-label="Saring karyawan" value={person} onChange={e => { setPerson(e.target.value); setLimit(PAGE) }} className="rounded-full bg-surface px-4 py-3 text-[13px] shadow-row outline-none">
                    <option value="all">Semua karyawan</option>
                    {data.people.map(p => <option key={p.id} value={p.id}>{p.display_name || 'Tanpa nama'}</option>)}
                </select>
                <div className="flex flex-wrap gap-1 rounded-full bg-fill-subtle p-1">
                    {(['all', ...COMPANY_LEAD_STATUSES] as string[]).map(key => (
                        <button key={key} onClick={() => { setStatus(key); setLimit(PAGE) }} className={`rounded-full px-3.5 py-2 text-[12px] font-medium ${status === key ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'}`}>
                            {key === 'all' ? 'Semua' : LABELS[key]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-card bg-surface shadow-card">
                <ul className="divide-y divide-hairline">
                    {filtered.slice(0, limit).map(lead => {
                        const badge = leadStatusBadge(lead.status)
                        return (
                            <li key={lead.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                                <div className="min-w-[220px] flex-1">
                                    <p className="text-[13.5px] font-semibold">{lead.name || 'Tanpa nama'}</p>
                                    <p className="text-[11.5px] text-ink-2">{[lead.job_title, lead.company].filter(Boolean).join(' · ') || '—'}</p>
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-ink-2">
                                        {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-ink"><Mail className="h-3 w-3" strokeWidth={1.8} />{lead.email}</a>}
                                        {lead.whatsapp && <a href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink"><Phone className="h-3 w-3" strokeWidth={1.8} />{lead.whatsapp}</a>}
                                    </div>
                                </div>
                                <div className="w-[160px] text-[11.5px] text-ink-2">
                                    <p>dari <span className="font-medium text-ink">{people.get(lead.profile_id)}</span></p>
                                    <p>{new Date(lead.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <select
                                    aria-label={`Status lead ${lead.name || ''}`}
                                    value={badge.key}
                                    disabled={saving === lead.id}
                                    onChange={e => changeStatus(lead.id, e.target.value)}
                                    className={`rounded-full px-3.5 py-2 text-[12px] font-medium outline-none disabled:opacity-50 ${badge.tone}`}
                                >
                                    {(COMPANY_LEAD_STATUSES as string[]).map(key => <option key={key} value={key}>{LABELS[key]}</option>)}
                                </select>
                            </li>
                        )
                    })}
                    {!filtered.length && <li className="px-5 py-10 text-center text-[13px] text-ink-2">Tidak ada leads yang cocok.</li>}
                </ul>
                {filtered.length > limit && (
                    <div className="border-t border-hairline p-4 text-center">
                        <button onClick={() => setLimit(l => l + PAGE)} className="rounded-full bg-fill-subtle px-5 py-2.5 text-[12.5px] font-medium hover:bg-track">Tampilkan lebih banyak ({filtered.length - limit} lagi)</button>
                    </div>
                )}
            </div>
        </div>
    )
}
