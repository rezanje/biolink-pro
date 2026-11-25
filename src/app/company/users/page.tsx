'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { useCompany } from '@/app/company/company-context'

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

type SortKey = 'name' | 'leads' | 'taps' | 'views30'

export default function CompanyUsersPage() {
    const { data } = useCompany()
    const [q, setQ] = useState('')
    const [sort, setSort] = useState<SortKey>('leads')

    const rows = useMemo(() => {
        if (!data) return []
        const stats = new Map(data.summary.perPerson.map(s => [s.id, s]))
        const term = q.trim().toLowerCase()
        return data.people
            .filter(p => !term || [p.display_name, p.email, p.job_title].some(v => v?.toLowerCase().includes(term)))
            .map(p => ({ person: p, stats: stats.get(p.id)! }))
            .sort((a, b) => sort === 'name'
                ? (a.person.display_name || '').localeCompare(b.person.display_name || '')
                : (b.stats?.[sort] || 0) - (a.stats?.[sort] || 0))
    }, [data, q, sort])

    if (!data) return null

    return (
        <div>
            <header className="mt-6">
                <h1 className="company-heading text-[26px] font-semibold tracking-[-0.03em]">Karyawan</h1>
                <p className="mt-1.5 text-[13px] text-ink-2">{data.people.length} pemegang kartu di {data.company.name}</p>
            </header>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.8} />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama, email, jabatan..." className="w-full rounded-full bg-surface py-3 pl-11 pr-4 text-[13px] shadow-row outline-none placeholder:text-ink-3 focus:ring-1 focus:ring-ink/15" />
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-full bg-fill-subtle p-1">
                    {([['leads', 'Leads'], ['taps', 'Tap'], ['views30', 'Dilihat'], ['name', 'Nama']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setSort(key)} className={`rounded-full px-3.5 py-2 text-[12px] font-medium ${sort === key ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'}`}>{label}</button>
                    ))}
                </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-card bg-surface shadow-card">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-hairline text-left text-[10px] font-medium uppercase tracking-wider text-ink-2">
                                <th className="px-5 py-3.5">Karyawan</th>
                                <th className="px-4 py-3.5">Perangkat</th>
                                <th className="px-4 py-3.5">Tap</th>
                                <th className="px-4 py-3.5">Dilihat 30 hr</th>
                                <th className="px-4 py-3.5">Leads</th>
                                <th className="px-4 py-3.5">Lead terakhir</th>
                                <th className="px-4 py-3.5 text-right">Kartu</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                            {rows.map(({ person, stats }) => (
                                <tr key={person.id} className="hover:bg-fill-subtle/60">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            {person.avatar_url
                                                // eslint-disable-next-line @next/next/no-img-element
                                                ? <img src={person.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                                                : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-avatar text-[12.5px] font-semibold text-avatar-ink">{person.display_name?.[0]?.toUpperCase() || '?'}</span>}
                                            <div className="min-w-0">
                                                <p className="truncate text-[13px] font-semibold">{person.display_name || 'Tanpa nama'}{person.role === 'company_admin' && <span className="ml-1.5 rounded-full bg-fill-subtle px-2 py-0.5 text-[10px] font-medium text-ink-2">Admin</span>}</p>
                                                <p className="truncate text-[11.5px] text-ink-2">{person.job_title || person.email || '—'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-[13px]">{stats?.devices || 0}</td>
                                    <td className="px-4 py-4 text-[13px]">{stats?.taps || 0}</td>
                                    <td className="px-4 py-4 text-[13px]">{stats?.views30 || 0}</td>
                                    <td className="px-4 py-4">
                                        <p className="text-[13px] font-semibold">{stats?.leads || 0}</p>
                                        <p className="text-[11px] text-ink-2">{stats?.leadsNew || 0} baru · {stats?.leadsConverted || 0} klien</p>
                                    </td>
                                    <td className="px-4 py-4 text-[12px] text-ink-2">{fmt(stats?.lastLead || null)}</td>
                                    <td className="px-4 py-4 text-right">
                                        {person.slug && (
                                            <a href={`/${person.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`Buka kartu ${person.display_name || ''}`} className="inline-flex rounded-full p-2 text-ink-2 hover:bg-fill-subtle hover:text-ink">
                                                <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!rows.length && <tr><td colSpan={7} className="px-5 py-10 text-center text-[13px] text-ink-2">Tidak ada karyawan ditemukan.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
