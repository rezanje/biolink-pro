'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, IdCard, LayoutDashboard, LogOut, MessageSquareText, Users } from 'lucide-react'
import PageMotion from '@/components/motion/PageMotion'
import { useCompany } from '@/app/company/company-context'
import { createClient } from '@/lib/supabase/client'
import { companyDashboardTheme } from '@/lib/company-dashboard-theme.mjs'
import type { CSSProperties } from 'react'

const ITEMS = [
    { href: '/company/dashboard', icon: LayoutDashboard, label: 'Ringkasan' },
    { href: '/company/users', icon: Users, label: 'Karyawan' },
    { href: '/company/leads', icon: MessageSquareText, label: 'Leads' },
]

// Cangkang dashboard perusahaan, arah desain Kabut (sama dengan dashboard pelanggan).
export default function CompanyShell({ children }: { children: React.ReactNode }) {
    const { data, companyParam } = useCompany()
    const pathname = usePathname()
    const router = useRouter()
    // Dashboard ikut tema kartu perusahaan (mis. CNY: hijau hutan + merah).
    const theme = companyDashboardTheme(data?.company)
    const themeStyle = theme ? { ...theme.vars, '--company-heading-font': theme.headingFont || 'inherit' } as unknown as CSSProperties : undefined
    const suffix = companyParam ? `?company=${encodeURIComponent(companyParam)}` : ''

    const signOut = async () => {
        await createClient().auth.signOut()
        router.push('/login')
    }

    return (
        <div className="min-h-screen bg-canvas font-kabut text-ink" data-company-mode={theme?.mode} data-company-template={theme?.template} style={themeStyle}>
            <div className="mx-auto max-w-[1200px] px-5 pb-[140px] pt-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5 rounded-full bg-surface py-1.5 pl-1.5 pr-4 shadow-row">
                        {theme?.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={theme.logo} alt="" className="ml-2 h-8 w-auto max-w-[72px] object-contain" />
                        ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-fill-subtle text-ink-2">
                                {data?.company.logo_url
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={data.company.logo_url} alt="" className="h-full w-full object-contain" />
                                    : <Building2 className="h-4 w-4" strokeWidth={1.8} />}
                            </span>
                        )}
                        <span className="truncate text-[12.5px] font-medium">{data?.company.name}</span>
                        <span className="hidden text-[11px] text-ink-3 sm:inline">· Portal perusahaan</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {data?.viewerRole === 'super_admin' && (
                            <Link href="/admin" className="hidden rounded-full bg-surface px-4 py-2.5 text-[12.5px] font-medium shadow-row sm:inline-flex">Admin Gentanala</Link>
                        )}
                        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[12.5px] font-medium shadow-row">
                            <IdCard className="h-4 w-4" strokeWidth={1.8} /> <span className="hidden sm:inline">Kartu saya</span>
                        </Link>
                        <button onClick={signOut} aria-label="Keluar" className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[12.5px] font-medium shadow-row">
                            <LogOut className="h-4 w-4" strokeWidth={1.8} /> <span className="hidden sm:inline">Keluar</span>
                        </button>
                    </div>
                </div>
                <PageMotion key={pathname}>{children}</PageMotion>
            </div>

            <div className="fixed bottom-6 left-[22px] right-[22px] z-50 md:left-1/2 md:w-[300px] md:-translate-x-1/2">
                <nav aria-label="Navigasi perusahaan" className="company-nav h-[68px] rounded-full border border-white/80 bg-white/[0.72] px-2 shadow-nav backdrop-blur-[26px] backdrop-saturate-[1.7]">
                    <ul className="flex h-full items-center justify-around">
                        {ITEMS.map(item => {
                            const active = pathname === item.href
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={`${item.href}${suffix}`}
                                        aria-current={active ? 'page' : undefined}
                                        aria-label={item.label}
                                        title={item.label}
                                        className={`flex h-[50px] w-[50px] items-center justify-center rounded-full transition-colors ${active ? 'bg-ink/[0.08] text-ink' : 'text-ink-2 hover:text-ink'}`}
                                    >
                                        <item.icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </nav>
            </div>
        </div>
    )
}
