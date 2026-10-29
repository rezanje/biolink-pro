'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Users, ContactRound, Clock3, CheckCheck } from 'lucide-react'
import { useCompany } from '@/app/company/company-context'

interface Summary {
    counts: { people: number; leads: number; new: number; contacted: number; converted: number }
    recentLeads: { id: string; name: string; status: string; created_at: string; profiles: { display_name: string | null } }[]
}

export default function CompanyDashboardPage() {
    const { company } = useCompany()
    const [summary, setSummary] = useState<Summary | null>(null)
    const [error, setError] = useState(false)
    useEffect(() => {
        const controller = new AbortController()
        fetch('/api/company/workspace?view=summary', { signal: controller.signal, cache: 'no-store' })
            .then(async response => { if (!response.ok) throw Error('summary'); return response.json() })
            .then(setSummary).catch(() => { if (!controller.signal.aborted) setError(true) })
        return () => controller.abort()
    }, [])
    const cards = [
        { label: 'Pemilik kartu', value: summary?.counts.people, icon: Users, href: '/company/users' },
        { label: 'Total leads', value: summary?.counts.leads, icon: ContactRound, href: '/company/leads' },
        { label: 'Leads baru', value: summary?.counts.new, icon: Clock3, href: '/company/leads?status=new' },
        { label: 'Konversi', value: summary?.counts.converted, icon: CheckCheck, href: '/company/leads?status=converted' },
    ]
    return <div className="space-y-9">
        <div className="border-b border-[#ccd4ca] pb-7"><p className="uppercase tracking-[.22em] text-xs font-bold text-[var(--company-accent)]">Workspace perusahaan</p>
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mt-3">Selamat datang, {company?.name}</h1>
            <p className="text-[#637268] mt-3 max-w-xl">Pantau pemilik kartu digital dan tindak lanjut leads perusahaan Anda.</p>
        </div>
        {error && <p role="alert" className="bg-red-50 text-red-800 rounded-lg p-4">Data belum bisa dimuat. Coba muat ulang halaman.</p>}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
            {cards.map(({ label, value, icon: Icon, href }) => <Link key={label} href={href} className="bg-white border border-[#dce3d9] rounded-2xl p-5 sm:p-7 hover:border-[var(--company-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--company-accent)]">
                <div className="flex items-start justify-between"><Icon className="w-5 h-5 text-[var(--company-accent)]" aria-hidden="true" /><ArrowUpRight className="w-4 h-4 text-[#8a9c90]" aria-hidden="true" /></div>
                <p className="text-3xl sm:text-4xl font-semibold mt-9 tabular-nums">{value ?? '—'}</p><p className="text-sm text-[#637268] mt-2">{label}</p>
            </Link>)}
        </div>
        <div className="grid lg:grid-cols-[1.7fr_1fr] gap-5">
            <section className="bg-white border border-[#dce3d9] rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b border-[#edf0e9]"><h2 className="text-xl font-semibold">Leads terbaru</h2><Link href="/company/leads" className="text-sm font-semibold text-[var(--company-accent)] hover:underline">Lihat semua</Link></div>
                {summary?.recentLeads.length ? <ul className="divide-y divide-[#edf0e9]">{summary.recentLeads.map(lead => <li key={lead.id} className="p-5 sm:px-6 flex items-center justify-between gap-4"><div className="min-w-0"><p className="font-semibold truncate">{lead.name}</p><p className="text-xs text-[#68776d] mt-1 truncate">{lead.profiles?.display_name || 'Kartu perusahaan'} · {new Date(lead.created_at).toLocaleDateString('id-ID')}</p></div><span className="text-xs uppercase tracking-wide text-[#526358] shrink-0">{lead.status}</span></li>)}</ul> :
                    <p className="p-8 text-[#637268]">{summary ? 'Belum ada leads yang masuk.' : 'Memuat leads…'}</p>}
            </section>
            <section className="bg-[var(--company-primary)] text-white rounded-2xl p-7 sm:p-8 flex flex-col justify-between min-h-64"><div><p className="uppercase tracking-[.2em] text-xs text-white/60">Alur leads</p><h2 className="text-2xl font-semibold mt-4">Dari pertemuan ke tindak lanjut.</h2><p className="text-white/70 text-sm mt-3">Lihat kontak dari kartu perusahaan, perbarui status, dan ikuti progresnya.</p></div><Link href="/company/leads" className="mt-8 w-fit inline-flex items-center gap-2 border-b border-white pb-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-white">Kelola leads <ArrowUpRight className="w-4 h-4" /></Link></section>
        </div>
    </div>
}
