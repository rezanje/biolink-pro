'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    LayoutDashboard,
    User,
    Link2,
    Palette,
    LogOut,
    CreditCard,
    ExternalLink,
    BarChart3
} from 'lucide-react'
import PhonePreview from '@/components/dashboard/PhonePreview'
import { useTier } from '@/app/dashboard/tier-context'
import KabutNav from '@/components/dashboard/KabutNav'
import { createClient } from '@/lib/supabase/client'

const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', feature: 'analytics_leads' },
    { href: '/dashboard/profile', icon: User, label: 'Edit Profile' },
    { href: '/dashboard/links', icon: Link2, label: 'Manage Links' },
    { href: '/dashboard/appearance', icon: Palette, label: 'Appearance' },
]

// Rute yang sudah dipindahkan ke arah desain Kabut. Layar di daftar ini memakai
// kanvas + navigasi baru; sisanya tetap pakai cangkang lama sampai gilirannya
// dikerjakan. Daftar ini menyusut jadi tidak perlu begitu semua layar pindah.
const KABUT_ROUTES = [
    '/dashboard',
    '/dashboard/analytics',
    '/dashboard/profile',
    '/dashboard/links',
    '/dashboard/appearance',
    '/dashboard/ai-assistant',
]

export default function DashboardShell({ children }: { children: React.ReactNode }) {
    const [profile, setProfile] = useState<any>(null)
    const pathname = usePathname()
    const router = useRouter()
    const { hasFeature, isLoading } = useTier()

    useEffect(() => {
        const profileStr = localStorage.getItem('genhub_profile')
        if (profileStr) setProfile(JSON.parse(profileStr))
    }, [])

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()

        localStorage.removeItem('genhub_user')
        localStorage.removeItem('genhub_activated')
        localStorage.removeItem('genhub_profile')
        router.push('/login')
    }

    if (KABUT_ROUTES.includes(pathname)) {
        return (
            <div className="min-h-screen bg-canvas font-kabut text-ink">
                {children}
                <KabutNav />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#EDEEF3] flex overflow-hidden">
            {/* Sidebar Desktop — Liquid Glass Light */}
            <aside className="hidden lg:flex flex-col w-64 bg-white/50 backdrop-blur-2xl border-r border-white/40 shrink-0 shadow-sm">
                <div className="p-6">
                    <Link href="/" className="flex items-center gap-2">
                        <CreditCard className="w-8 h-8 text-blue-600" />
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">GenHub</span>
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        const isLocked = item.feature ? !hasFeature(item.feature) : false

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${isActive
                                    ? 'bg-blue-600/10 text-blue-600 font-medium shadow-sm border border-blue-100'
                                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/60'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : ''}`} />
                                    {item.label}
                                </div>
                                {isLocked && (
                                    <CreditCard className="w-4 h-4 text-zinc-300" />
                                )}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-zinc-200/50 space-y-4">
                    {profile && (
                        <Link
                            href={`/${profile.slug}`}
                            target="_blank"
                            className="flex items-center justify-between p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-zinc-200/50 hover:bg-white/80 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                                    {profile.display_name?.[0]?.toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 truncate">Preview Profile</p>
                                    <p className="text-xs text-zinc-400 truncate">/{profile.slug}</p>
                                </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-zinc-400" />
                        </Link>
                    )}

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Mobile Header — Liquid Glass Light */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                <header className="lg:hidden bg-white/50 backdrop-blur-2xl border-b border-white/40 p-4 flex items-center justify-between shadow-sm z-40">
                    <Link href="/" className="flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                        <span className="text-lg font-bold text-zinc-900">GenHub</span>
                    </Link>
                    <button onClick={handleLogout} aria-label="Sign out" className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </header>

                {/* Main Content + Preview */}
                <div className="flex-1 flex overflow-hidden">
                    <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 lg:p-12 text-zinc-900">
                        {children}
                    </main>

                    {/* Desktop Preview Sidebar — Liquid Glass */}
                    <aside className="hidden xl:flex flex-col w-[400px] border-l border-white/40 bg-white/30 backdrop-blur-xl items-center justify-center p-8 sticky top-0 h-full">
                        <div className="text-center mb-6">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-zinc-200/50 shadow-sm">
                                Live Preview
                            </span>
                        </div>
                        <PhonePreview />
                    </aside>
                </div>
            </div>

            {/* Mobile Bottom Navigation — Floating Liquid Glass */}
            <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
                <div className="bg-white/75 backdrop-blur-2xl border border-white/70 rounded-[26px] shadow-[0_10px_30px_rgba(20,21,26,0.12)]">
                    <nav className="flex items-center justify-around px-2 py-2 relative">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href
                            const isLocked = item.feature ? !hasFeature(item.feature) : false

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex flex-col items-center justify-center p-2 rounded-[17px] transition-all relative flex-1 ${isActive
                                        ? 'text-white'
                                        : 'text-zinc-500 hover:text-zinc-900'
                                        }`}
                                >
                                    {/* Active State Glass Pill */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="mobileNavIndicator"
                                            className="absolute inset-0 bg-[#14151A] rounded-[17px] z-0"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}

                                    <div className="relative z-10 flex flex-col items-center">
                                        <item.icon className="w-5 h-5 mb-1 text-inherit" />
                                        <span className={`text-[9px] font-semibold text-center leading-tight truncate w-full max-w-[4.5rem] ${isActive ? 'opacity-100 drop-shadow-sm' : 'opacity-70'}`}>
                                            {item.label}
                                        </span>
                                    </div>

                                    {isLocked && (
                                        <div className="absolute top-1 right-2 w-2 h-2 bg-amber-500 rounded-full border border-white shadow-sm z-20" />
                                    )}
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            </div>
        </div >
    )
}
