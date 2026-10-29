'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Building2, LayoutDashboard, Users, ContactRound, Settings, Menu, X, ArrowUpRight } from 'lucide-react'
import { useCompany } from '@/app/company/company-context'
import { companyBrand } from '@/lib/company-brand.mjs'

const navigation = [
    { href: '/company/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
    { href: '/company/users', label: 'Pemilik Kartu', icon: Users },
    { href: '/company/leads', label: 'Leads & Progress', icon: ContactRound },
    { href: '/company/settings', label: 'Pengaturan', icon: Settings },
]

export default function CompanyShell({ children }: { children: React.ReactNode }) {
    const { company } = useCompany()
    const path = usePathname()
    const [open, setOpen] = useState(false)
    const brand = companyBrand(company)
    if (!company) return null
    const sidebar = <>
        <div className="px-7 pt-9 pb-10 border-b border-white/10">
            {brand.logo ? <Image src={brand.logo} alt={company.name} width={190} height={56} unoptimized className="max-h-14 max-w-[190px] object-contain object-left" /> :
                <div className="flex items-center gap-3 text-white"><Building2 aria-hidden="true" /><strong className="text-lg">{company.name}</strong></div>}
            <p className="text-[11px] tracking-[.2em] uppercase text-white/50 mt-5">Company workspace</p>
        </div>
        <nav aria-label="Navigasi perusahaan" className="px-4 py-7 space-y-1 flex-1">
            {navigation.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                aria-current={path === item.href ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${path === item.href ? 'bg-white text-[#17231b]' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                <item.icon className="w-4 h-4" aria-hidden="true" />{item.label}</Link>)}
        </nav>
        <div className="p-5 border-t border-white/10"><Link href="/dashboard" className="flex items-center justify-between text-sm text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white">Profil saya <ArrowUpRight className="w-4 h-4" /></Link></div>
    </>
    return <div className="min-h-screen bg-[#f4f5f0] text-[#203127] lg:flex">
        <aside className="hidden lg:flex lg:w-64 xl:w-72 shrink-0 flex-col bg-[var(--company-primary)] min-h-screen sticky top-0 h-screen">{sidebar}</aside>
        <div className="flex-1 min-w-0">
            <header className="lg:hidden flex justify-between items-center bg-[var(--company-primary)] text-white px-5 py-4">
                <span className="font-semibold truncate max-w-[75%]">{company.name}</span>
                <button type="button" onClick={() => setOpen(true)} aria-label="Buka menu" className="p-2 focus-visible:outline-2 focus-visible:outline-white"><Menu /></button>
            </header>
            <main id="main" className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-8 lg:py-12">{children}</main>
        </div>
        {open && <div className="fixed inset-0 z-50 lg:hidden flex">
            <aside className="w-[min(85vw,320px)] h-full flex flex-col bg-[var(--company-primary)]" aria-label="Menu perusahaan">
                <button type="button" onClick={() => setOpen(false)} aria-label="Tutup menu" className="self-end text-white p-4 focus-visible:outline-2 focus-visible:outline-white"><X /></button>{sidebar}
            </aside><button type="button" onClick={() => setOpen(false)} aria-label="Tutup menu" className="flex-1 bg-black/55" />
        </div>}
    </div>
}
