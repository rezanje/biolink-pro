'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Clock3 } from 'lucide-react'
import { useCompany } from '@/app/company/company-context'

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// Semua kartu/jam yang dibuat untuk perusahaan: siapa pemegangnya, dan mana
// yang belum diaktifkan.
export default function CompanyCardsPage() {
    const { data } = useCompany()
    const [filter, setFilter] = useState<'all' | 'inactive' | 'active'>('all')

    const people = useMemo(() => new Map((data?.people || []).map(p => [p.id, p])), [data])
    const cards = useMemo(() => (data?.cards || [])
        .filter(c => filter === 'all' || (filter === 'active' ? c.active : !c.active))
        .sort((a, b) => Number(a.active) - Number(b.active) || b.created_at.localeCompare(a.created_at)), [data, filter])

    if (!data) return null
    const total = data.cards.length
    const inactive = data.cards.filter(c => !c.active).length

    return (
        <div>
            <header className="mt-6">
                <h1 className="company-heading text-[26px] font-semibold tracking-[-0.03em]">Kartu</h1>
                <p className="mt-1.5 text-[13px] text-ink-2">{total} kartu & jam untuk {data.company.name} · {total - inactive} aktif · {inactive} belum diaktifkan</p>
            </header>

            <section className="mt-6 grid grid-cols-3 gap-3">
                {[
                    { label: 'Total kartu', value: total },
                    { label: 'Sudah aktif', value: total - inactive },
                    { label: 'Belum aktif', value: inactive, tone: inactive ? 'text-coral' : '' },
                ].map(s => (
                    <div key={s.label} className="rounded-card-sm bg-surface px-4 py-4 text-center shadow-card">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-ink-2">{s.label}</p>
                        <p className={`mt-1.5 text-[24px] font-semibold leading-none ${s.tone || ''}`}>{s.value}</p>
                    </div>
                ))}
            </section>

            <div className="mt-5 inline-grid grid-cols-3 gap-1 rounded-full bg-fill-subtle p-1">
                {([['all', 'Semua'], ['inactive', 'Belum aktif'], ['active', 'Aktif']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setFilter(key)} className={`rounded-full px-4 py-2 text-[12px] font-medium ${filter === key ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'}`}>{label}</button>
                ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-card bg-surface shadow-card">
                <ul className="divide-y divide-hairline">
                    {cards.map(card => {
                        const person = card.person_id ? people.get(card.person_id) : null
                        return (
                            <li key={card.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.active ? 'bg-success-soft text-success-soft-ink' : 'bg-coral-soft text-coral-soft-ink'}`}>
                                    {card.active ? <CheckCircle2 className="h-[17px] w-[17px]" strokeWidth={1.8} /> : <Clock3 className="h-[17px] w-[17px]" strokeWidth={1.8} />}
                                </span>
                                <div className="min-w-[180px] flex-1">
                                    <p className="text-[13.5px] font-semibold">{card.device} <span className="ml-1 rounded-md bg-fill-subtle px-1.5 py-0.5 font-mono text-[11px] font-normal text-ink-2">{card.code}</span></p>
                                    <p className="text-[11.5px] text-ink-2">
                                        {card.active
                                            ? <>Dipegang <b className="font-medium text-ink">{person?.display_name || 'karyawan lain'}</b> · aktif sejak {fmt(card.claimed_at)}</>
                                            : <>Belum diaktifkan · dibuat {fmt(card.created_at)}</>}
                                    </p>
                                </div>
                                <div className="w-[140px] text-right text-[11.5px] text-ink-2">
                                    {card.active ? <><b className="font-semibold text-ink">{card.taps}</b> tap · terakhir {fmt(card.last_tapped_at)}</> : <span className="text-coral">Minta karyawan tap & daftar</span>}
                                </div>
                            </li>
                        )
                    })}
                    {!cards.length && <li className="px-5 py-10 text-center text-[13px] text-ink-2">{total ? 'Tidak ada kartu di filter ini.' : 'Belum ada kartu yang dibuat untuk perusahaan ini.'}</li>}
                </ul>
            </div>
            <p className="mt-3 text-[11.5px] text-ink-3">Kode = 8 huruf awal nomor seri, sama dengan yang tercatat di tim Gentanala. Kartu aktif begitu karyawan menempelkannya ke HP lalu mendaftar.</p>
        </div>
    )
}
