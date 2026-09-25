'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Home, Link2, Palette, User } from 'lucide-react'

// Navigasi melayang area dashboard: pil berisi empat tombol bundar, plus satu
// tombol aksi gelap yang berdiri sendiri di sebelahnya. Sengaja terpisah dari
// DashboardShell lama supaya layar yang belum dipindahkan tetap memakai
// navigasi lamanya tanpa bentrok.
const ITEMS = [
    { href: '/dashboard', icon: Home, label: 'Overview' },
    { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/dashboard/links', icon: Link2, label: 'Links' },
    { href: '/dashboard/profile', icon: User, label: 'Profile' },
    { href: '/dashboard/appearance', icon: Palette, label: 'Appearance' },
]

export default function KabutNav() {
    const pathname = usePathname()

    return (
        <div className="fixed bottom-6 left-[22px] right-[22px] z-50 md:left-1/2 md:w-[420px] md:-translate-x-1/2">
            <nav
                aria-label="Dashboard navigation"
                className="h-[68px] rounded-full border border-white/80 bg-white/[0.72] px-2 shadow-nav backdrop-blur-[26px] backdrop-saturate-[1.7]"
            >
                <ul className="flex h-full items-center justify-around">
                    {ITEMS.map((item) => {
                        const active = pathname === item.href
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    aria-current={active ? 'page' : undefined}
                                    aria-label={item.label}
                                    className={`flex h-[50px] w-[50px] items-center justify-center rounded-full transition-colors ${active ? 'bg-ink/[0.08] text-ink' : 'text-ink-2 hover:text-ink'
                                        }`}
                                >
                                    <item.icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </nav>
        </div>
    )
}
