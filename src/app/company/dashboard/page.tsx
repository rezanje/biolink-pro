'use client'

import Link from 'next/link'
import { Activity, ArrowRight, Eye, IdCard, MessageSquareText, Trophy, Users } from 'lucide-react'
import AnimatedNumber from '@/components/motion/AnimatedNumber'
import { useCompany } from '@/app/company/company-context'
import { LEAD_STATUS_LABELS } from '@/lib/company-workspace.mjs'
import { CARD_TEMPLATES } from '@/lib/card-design.mjs'
import { leadStatusBadge } from '@/components/company/lead-status'
import { companyDashboardTheme } from '@/lib/company-dashboard-theme.mjs'

export default function CompanyDashboardPage() {
    const { data, companyParam } = useCompany()
    if (!data) return null
    const { company, summary, people, leads } = data
    const { counts } = summary
    const suffix = companyParam ? `?company=${encodeURIComponent(companyParam)}` : ''
    const personName = (id: string) => people.find(p => p.id === id)?.display_name || 'Tanpa nama'
    const maxWeek = Math.max(1, ...summary.weeks.map(w => w.count))
    const theme = CARD_TEMPLATES.find((t: { id: string }) => t.id === company.card_template) as { name: string } | undefined
    const brand = companyDashboardTheme(company)

    return (
        <div>
            {brand?.hero ? (
                <header className="relative mt-6 overflow-hidden rounded-card bg-surface shadow-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={brand.hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
                    <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/80 to-transparent" />
                    <div className="relative flex min-h-[180px] flex-col justify-end p-6 sm:p-8">
                        {brand.logo && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={brand.logo} alt={company.name} className="mb-4 h-14 w-auto max-w-[120px] object-contain object-left" />
                        )}
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-coral">Portal perusahaan</p>
                        <h1 className="company-heading mt-1.5 text-[32px] font-normal leading-tight tracking-[-0.02em]">{company.name}</h1>
                        <p className="mt-1.5 text-[13px] text-ink-2">{brand.tagline ? `${brand.tagline} · ` : ''}Pantau kartu karyawan dan leads yang mereka dapat</p>
                    </div>
                </header>
            ) : (
                <header className="mt-6">
                    <h1 className="company-heading text-[26px] font-semibold tracking-[-0.03em]">{company.name}</h1>
                    <p className="mt-1.5 text-[13px] text-ink-2">
                        Pantau kartu karyawan dan leads yang mereka dapat{theme ? ` · tema kartu ${theme.name}` : ''}
                    </p>
                </header>
            )}

            {counts.unclaimed > 0 && (
                <Link href={`/company/cards${suffix}`} className="mt-5 flex items-center gap-3 rounded-card bg-coral-soft px-5 py-4 text-coral-soft-ink">
                    <IdCard className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                    <p className="flex-1 text-[13px]"><b className="font-semibold">{counts.unclaimed} kartu belum diaktifkan</b> karyawan. Lihat daftarnya supaya bisa diingatkan.</p>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
            )}

            <section className="mt-6 grid grid-cols-2 gap-y-6 rounded-card bg-surface px-3 py-6 shadow-card md:grid-cols-4">
                {[
                    { icon: Users, tone: 'bg-fill-subtle text-ink-2', value: counts.people, label: 'Karyawan', sub: `${counts.devices} perangkat aktif` },
                    { icon: Activity, tone: 'bg-coral-soft text-coral-soft-ink', value: counts.taps, label: 'Total tap', sub: `${counts.unclaimed} perangkat belum aktif` },
                    { icon: Eye, tone: 'bg-sky/35 text-ink', value: counts.views30, label: 'Dilihat 30 hari', sub: 'kunjungan kartu' },
                    { icon: MessageSquareText, tone: 'bg-success-soft text-success-soft-ink', value: counts.leads, label: 'Total leads', sub: `${counts.leads30} dalam 30 hari` },
                ].map(stat => (
                    <div key={stat.label} className="flex flex-col items-center px-2 text-center">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.tone}`}>
                            <stat.icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
                        </span>
                        <p className="mt-2.5 text-[10px] font-medium uppercase leading-tight tracking-wider text-ink-2">{stat.label}</p>
                        <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em]"><AnimatedNumber value={stat.value} /></p>
                        <p className="mt-1.5 text-[11px] text-ink-3">{stat.sub}</p>
                    </div>
                ))}
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                <section className="rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-[15px] font-semibold">Leads per minggu</h2>
                            <p className="text-[12px] text-ink-2">8 minggu terakhir</p>
                        </div>
                        <span className="rounded-full bg-fill-subtle px-3 py-1 text-[11.5px] text-ink-2">Konversi {counts.conversion}%</span>
                    </div>
                    <div className="mt-5 flex h-40 items-end gap-2" role="img" aria-label={`Leads per minggu: ${summary.weeks.map(w => w.count).join(', ')}`}>
                        {summary.weeks.map((week, i) => (
                            <div key={week.start} className="flex flex-1 flex-col items-center gap-1.5">
                                <span className="text-[10.5px] text-ink-2">{week.count || ''}</span>
                                <div className={`w-full rounded-t-[10px] ${i === summary.weeks.length - 1 ? 'bg-coral' : 'bg-track'}`} style={{ height: `${Math.max(4, (week.count / maxWeek) * 120)}px` }} />
                                <span className="text-[10px] text-ink-3">{new Date(week.start).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 grid grid-cols-4 gap-2">
                        {Object.entries(LEAD_STATUS_LABELS).map(([key, label]) => (
                            <div key={key} className="rounded-row bg-fill-subtle px-3 py-2.5">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-ink-2">{label as string}</p>
                                <p className="mt-1 text-[17px] font-semibold">{summary.status[key] || 0}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-card bg-surface p-5 shadow-card">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-butter/50 text-ink"><Trophy className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                        <div>
                            <h2 className="text-[15px] font-semibold">Karyawan teratas</h2>
                            <p className="text-[12px] text-ink-2">Berdasarkan jumlah leads</p>
                        </div>
                    </div>
                    <ol className="mt-4 space-y-2">
                        {summary.topPeople.map((row, i) => (
                            <li key={row.id} className="flex items-center gap-3 rounded-row bg-fill-subtle px-3 py-2.5">
                                <span className="w-4 text-[12px] font-semibold text-ink-3">{i + 1}</span>
                                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{personName(row.id)}</span>
                                <span className="text-[12px] text-ink-2"><b className="font-semibold text-ink">{row.leads}</b> leads · {row.leadsConverted} klien</span>
                            </li>
                        ))}
                        {!summary.topPeople.length && <li className="py-6 text-center text-[12.5px] text-ink-2">Belum ada leads dari karyawan.</li>}
                    </ol>
                </section>
            </div>

            <section className="mt-5 rounded-card bg-surface shadow-card">
                <div className="flex items-center justify-between px-5 pt-5">
                    <h2 className="text-[15px] font-semibold">Leads terbaru</h2>
                    <Link href={`/company/leads${suffix}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-coral">Semua leads <ArrowRight className="h-3.5 w-3.5" /></Link>
                </div>
                <ul className="mt-3 divide-y divide-hairline">
                    {leads.slice(0, 6).map(lead => {
                        const badge = leadStatusBadge(lead.status)
                        return (
                            <li key={lead.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-medium">{lead.name || 'Tanpa nama'}{lead.company ? <span className="text-ink-2"> · {lead.company}</span> : null}</p>
                                    <p className="truncate text-[11.5px] text-ink-2">dari {personName(lead.profile_id)} · {new Date(lead.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.tone}`}>{badge.label}</span>
                            </li>
                        )
                    })}
                    {!leads.length && <li className="px-5 py-10 text-center text-[13px] text-ink-2">Belum ada leads.</li>}
                </ul>
                <div className="h-2" />
            </section>

            {!people.length && (
                <section className="mt-5 flex items-start gap-3 rounded-card bg-coral-soft p-5 text-coral-soft-ink">
                    <IdCard className="mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                    <p className="text-[12.5px] leading-relaxed">Belum ada karyawan yang mengaktifkan kartu. Kartu yang dibuat untuk perusahaan ini otomatis masuk ke sini begitu karyawan mengaktifkannya.</p>
                </section>
            )}
        </div>
    )
}
